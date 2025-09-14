const { Octokit } = require('@octokit/rest');
const core = require('@actions/core');

class GitHubClient {
  constructor(token, repository) {
    this.octokit = new Octokit({
      auth: token,
      userAgent: 'github-actions-forensic-agent/1.0.0'
    });
    
    const [owner, repo] = repository.split('/');
    this.owner = owner;
    this.repo = repo;
    
    // Configuration pour la gestion des erreurs et retry
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 seconde
  }

  async withRetry(operation, context = '') {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Gestion spécifique des erreurs de rate limiting
        if (error.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
          const resetTime = parseInt(error.response.headers['x-ratelimit-reset']) * 1000;
          const waitTime = resetTime - Date.now() + 1000; // +1s de marge
          
          if (waitTime > 0 && waitTime < 300000) { // Max 5 minutes d'attente
            core.warning(`⏳ Rate limit atteint, attente de ${Math.round(waitTime/1000)}s...`);
            await this.sleep(waitTime);
            continue;
          }
        }
        
        // Retry pour les erreurs temporaires
        if (attempt < this.maxRetries && this.isRetryableError(error)) {
          core.warning(`⚠️ Tentative ${attempt}/${this.maxRetries} échouée pour ${context}: ${error.message}`);
          await this.sleep(this.retryDelay * attempt);
          continue;
        }
        
        break;
      }
    }
    
    throw new Error(`Échec après ${this.maxRetries} tentatives pour ${context}: ${lastError.message}`);
  }

  isRetryableError(error) {
    // Erreurs temporaires qui méritent un retry
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    return retryableStatuses.includes(error.status) || error.code === 'ECONNRESET';
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async listWorkflows() {
    return this.withRetry(async () => {
      const response = await this.octokit.rest.actions.listRepoWorkflows({
        owner: this.owner,
        repo: this.repo,
        per_page: 100
      });
      
      return response.data.workflows.map(workflow => ({
        id: workflow.id,
        name: workflow.name,
        path: workflow.path,
        state: workflow.state,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at
      }));
    }, 'listWorkflows');
  }

  async getWorkflowRuns(workflowId, limit = 50) {
    return this.withRetry(async () => {
      const response = await this.octokit.rest.actions.listWorkflowRuns({
        owner: this.owner,
        repo: this.repo,
        workflow_id: workflowId,
        per_page: Math.min(limit, 100)
      });
      
      return response.data.workflow_runs.map(run => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        created_at: run.created_at,
        updated_at: run.updated_at,
        head_branch: run.head_branch,
        head_sha: run.head_sha,
        event: run.event,
        jobs_url: run.jobs_url
      }));
    }, `getWorkflowRuns(${workflowId})`);
  }

  async getJobs(runId) {
    return this.withRetry(async () => {
      const response = await this.octokit.rest.actions.listJobsForWorkflowRun({
        owner: this.owner,
        repo: this.repo,
        run_id: runId
      });
      
      return response.data.jobs.map(job => ({
        id: job.id,
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
        started_at: job.started_at,
        completed_at: job.completed_at,
        steps: job.steps
      }));
    }, `getJobs(${runId})`);
  }

  async getJobLogs(runId, jobId) {
    return this.withRetry(async () => {
      try {
        const response = await this.octokit.rest.actions.downloadJobLogsForWorkflowRun({
          owner: this.owner,
          repo: this.repo,
          job_id: jobId
        });
        
        // Les logs sont retournés sous forme de buffer/string
        return response.data || '';
      } catch (error) {
        if (error.status === 404) {
          core.warning(`📝 Logs non disponibles pour le job ${jobId}`);
          return '';
        }
        throw error;
      }
    }, `getJobLogs(${runId}, ${jobId})`);
  }

  async getWorkflowContent(path) {
    return this.withRetry(async () => {
      try {
        const response = await this.octokit.rest.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: path
        });
        
        // Décodage du contenu base64
        const content = Buffer.from(response.data.content, 'base64').toString('utf8');
        return content;
      } catch (error) {
        if (error.status === 404) {
          core.warning(`📄 Fichier workflow non trouvé: ${path}`);
          return '';
        }
        throw error;
      }
    }, `getWorkflowContent(${path})`);
  }

  async createAnnotation(annotation) {
    return this.withRetry(async () => {
      // Création d'une annotation via l'API Checks
      const response = await this.octokit.rest.checks.create({
        owner: this.owner,
        repo: this.repo,
        name: 'Forensic Analysis',
        head_sha: annotation.sha || 'HEAD',
        status: 'completed',
        conclusion: annotation.level === 'failure' ? 'failure' : 'neutral',
        output: {
          title: annotation.title,
          summary: annotation.message,
          annotations: [{
            path: annotation.path || '.github/workflows/',
            start_line: annotation.start_line || 1,
            end_line: annotation.end_line || 1,
            annotation_level: annotation.level || 'warning',
            message: annotation.message,
            title: annotation.title
          }]
        }
      });
      
      return response.data;
    }, 'createAnnotation');
  }

  async getCurrentCommitSha() {
    return this.withRetry(async () => {
      const response = await this.octokit.rest.repos.getBranch({
        owner: this.owner,
        repo: this.repo,
        branch: 'main' // ou 'master', selon la configuration
      });
      
      return response.data.commit.sha;
    }, 'getCurrentCommitSha');
  }
}

module.exports = GitHubClient;

