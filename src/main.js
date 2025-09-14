const core = require('@actions/core');
const github = require('@actions/github');
const GitHubClient = require('./github-api');
const ForensicAnalyzer = require('./analyzer');
const ReportGenerator = require('./reporter');

async function run() {
  try {
    // Récupération des inputs
    const repository = core.getInput('repository', { required: true });
    const githubToken = core.getInput('github-token', { required: true });
    const deepScan = core.getInput('deep-scan') === 'true';
    const maxRuns = parseInt(core.getInput('max-runs') || '50');
    const outputFormat = core.getInput('output-format') || 'both';

    core.info(`🔍 Démarrage de l'analyse forensique pour ${repository}`);
    core.info(`📊 Configuration: deep-scan=${deepScan}, max-runs=${maxRuns}, format=${outputFormat}`);

    // Initialisation du client GitHub
    const githubClient = new GitHubClient(githubToken, repository);
    
    // Initialisation de l'analyseur et du générateur de rapports
    const analyzer = new ForensicAnalyzer();
    const reporter = new ReportGenerator();

    // Étape 1: Récupération des workflows
    core.info('📋 Récupération de la liste des workflows...');
    const workflows = await githubClient.listWorkflows();
    core.info(`✅ ${workflows.length} workflows trouvés`);

    let allIssues = [];
    let hiddenFailuresCount = 0;
    let criticalIssues = [];

    // Étape 2: Analyse de chaque workflow
    for (const workflow of workflows) {
      core.info(`🔎 Analyse du workflow: ${workflow.name}`);
      
      // Récupération des exécutions récentes
      const runs = await githubClient.getWorkflowRuns(workflow.id, maxRuns);
      core.info(`📊 ${runs.length} exécutions récentes trouvées`);

      // Analyse des exécutions
      const runAnalysis = await analyzer.analyzeWorkflowRuns(runs);
      
      // Récupération et analyse du contenu YAML
      const workflowContent = await githubClient.getWorkflowContent(workflow.path);
      const yamlAnalysis = await analyzer.findSuspiciousPatterns(workflowContent);

      // Analyse approfondie des logs si demandée
      if (deepScan) {
        core.info('🔬 Analyse approfondie des logs activée...');
        for (const run of runs.slice(0, 10)) { // Limite à 10 runs pour éviter les timeouts
          try {
            const jobs = await githubClient.getJobs(run.id);
            for (const job of jobs) {
              if (job.conclusion === 'failure' || job.conclusion === 'cancelled') {
                const logs = await githubClient.getJobLogs(run.id, job.id);
                const logAnalysis = await analyzer.analyzeLogs(logs);
                allIssues.push(...logAnalysis.issues);
              }
            }
          } catch (error) {
            core.warning(`⚠️ Impossible d'analyser les logs pour le run ${run.id}: ${error.message}`);
          }
        }
      }

      // Compilation des résultats
      allIssues.push(...runAnalysis.issues, ...yamlAnalysis.issues);
      hiddenFailuresCount += runAnalysis.hiddenFailures;
      
      // Identification des problèmes critiques
      const workflowCriticalIssues = allIssues.filter(issue => issue.severity === 'critical');
      criticalIssues.push(...workflowCriticalIssues);
    }

    // Étape 3: Calcul du score de risque global
    const riskScore = analyzer.calculateRiskScore(allIssues);
    core.info(`📈 Score de risque calculé: ${riskScore}/100`);

    // Étape 4: Génération des rapports
    const analysisResults = {
      repository,
      timestamp: new Date().toISOString(),
      summary: {
        totalWorkflows: workflows.length,
        totalIssues: allIssues.length,
        hiddenFailures: hiddenFailuresCount,
        criticalIssues: criticalIssues.length,
        riskScore
      },
      workflows: workflows.map(w => w.name),
      issues: allIssues,
      criticalIssues,
      recommendations: analyzer.generateRecommendations(allIssues)
    };

    let reportPath = '';
    
    if (outputFormat === 'markdown' || outputFormat === 'both') {
      const markdownReport = reporter.generateMarkdownReport(analysisResults);
      const markdownPath = 'forensic-analysis-report.md';
      await reporter.saveReport(markdownReport, markdownPath);
      reportPath = markdownPath;
      core.info(`📄 Rapport Markdown généré: ${markdownPath}`);
    }

    if (outputFormat === 'json' || outputFormat === 'both') {
      const jsonReport = reporter.generateJSONReport(analysisResults);
      const jsonPath = 'forensic-analysis-report.json';
      await reporter.saveReport(jsonReport, jsonPath);
      if (!reportPath) reportPath = jsonPath;
      core.info(`📊 Rapport JSON généré: ${jsonPath}`);
    }

    // Étape 5: Création des annotations pour les problèmes critiques
    if (criticalIssues.length > 0) {
      core.info(`🚨 Création d'annotations pour ${criticalIssues.length} problèmes critiques`);
      const annotations = reporter.generateAnnotations(criticalIssues);
      for (const annotation of annotations) {
        await githubClient.createAnnotation(annotation);
      }
    }

    // Définition des outputs
    core.setOutput('hidden-failures', hiddenFailuresCount.toString());
    core.setOutput('critical-issues', JSON.stringify(criticalIssues));
    core.setOutput('report-path', reportPath);
    core.setOutput('success', 'true');

    // Résumé final
    core.info('✅ Analyse forensique terminée avec succès');
    core.info(`📊 Résumé: ${allIssues.length} problèmes détectés, ${hiddenFailuresCount} échecs cachés, ${criticalIssues.length} problèmes critiques`);
    
    if (criticalIssues.length > 0) {
      core.warning(`🚨 ${criticalIssues.length} problèmes critiques nécessitent une attention immédiate`);
    }

  } catch (error) {
    core.setFailed(`❌ Erreur lors de l'analyse forensique: ${error.message}`);
    core.setOutput('success', 'false');
    
    // Log détaillé de l'erreur pour le débogage
    core.debug(`Stack trace: ${error.stack}`);
  }
}

// Exécution du script principal
if (require.main === module) {
  run();
}

module.exports = run;

