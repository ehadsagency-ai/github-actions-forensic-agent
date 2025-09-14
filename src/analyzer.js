const yaml = require('js-yaml');
const _ = require('lodash');

class ForensicAnalyzer {
  constructor() {
    // Patterns suspects à détecter
    this.suspiciousPatterns = {
      continueOnError: /continue-on-error:\s*true/gi,
      ignoreErrors: /\|\|\s*true/g,
      skipTests: /skip.*test/gi,
      unsafeShell: /shell:\s*bash.*\$\{/gi,
      hardcodedSecrets: /(password|token|key|secret).*[:=]\s*['"]\w+['"]/gi,
      unsafeDownloads: /curl.*\|\s*bash/gi,
      privilegedMode: /privileged:\s*true/gi
    };

    // Mots-clés critiques dans les logs
    this.criticalKeywords = [
      'error', 'failed', 'failure', 'exception', 'panic', 'fatal',
      'unauthorized', 'forbidden', 'timeout', 'killed', 'segmentation fault',
      'out of memory', 'disk full', 'permission denied'
    ];

    // Patterns de secrets exposés
    this.secretPatterns = [
      /(?:password|passwd|pwd)[\s]*[:=][\s]*['"]?([^\s'"]+)/gi,
      /(?:token|key|secret)[\s]*[:=][\s]*['"]?([^\s'"]+)/gi,
      /(?:api[_-]?key)[\s]*[:=][\s]*['"]?([^\s'"]+)/gi,
      /(?:access[_-]?token)[\s]*[:=][\s]*['"]?([^\s'"]+)/gi
    ];
  }

  async analyzeWorkflowRuns(runs) {
    const issues = [];
    let hiddenFailures = 0;

    for (const run of runs) {
      // Détection des échecs masqués
      if (run.conclusion === 'success' && this.hasHiddenFailures(run)) {
        hiddenFailures++;
        issues.push({
          type: 'hidden_failure',
          severity: 'high',
          workflow: run.name,
          run_id: run.id,
          message: 'Workflow marqué comme réussi mais contient des échecs masqués',
          recommendation: 'Vérifier les steps avec continue-on-error et les conditions de sortie'
        });
      }

      // Analyse des patterns temporels suspects
      const temporalIssues = this.analyzeTemporalPatterns(runs);
      issues.push(...temporalIssues);

      // Détection des timeouts fréquents
      if (run.conclusion === 'cancelled' || run.conclusion === 'timed_out') {
        issues.push({
          type: 'timeout_issue',
          severity: 'medium',
          workflow: run.name,
          run_id: run.id,
          message: 'Workflow annulé ou timeout détecté',
          recommendation: 'Optimiser les temps d\'exécution ou augmenter les timeouts'
        });
      }

      // Analyse des échecs récurrents
      const failurePattern = this.analyzeFailurePatterns(runs, run);
      if (failurePattern.isRecurrent) {
        issues.push({
          type: 'recurrent_failure',
          severity: 'high',
          workflow: run.name,
          message: `Échecs récurrents détectés (${failurePattern.count} sur les dernières exécutions)`,
          recommendation: 'Investiguer la cause racine des échecs récurrents'
        });
      }
    }

    return {
      issues,
      hiddenFailures,
      totalRuns: runs.length,
      successRate: this.calculateSuccessRate(runs)
    };
  }

  hasHiddenFailures(run) {
    // Logique pour détecter si un run "réussi" contient en fait des échecs
    // Ceci serait normalement basé sur l'analyse des jobs et steps
    return false; // Placeholder - nécessiterait l'analyse des jobs
  }

  analyzeTemporalPatterns(runs) {
    const issues = [];
    const sortedRuns = _.sortBy(runs, 'created_at');
    
    // Détection de dégradation des performances
    const recentRuns = sortedRuns.slice(-10);
    const olderRuns = sortedRuns.slice(-20, -10);
    
    if (recentRuns.length > 0 && olderRuns.length > 0) {
      const recentAvgDuration = this.calculateAverageDuration(recentRuns);
      const olderAvgDuration = this.calculateAverageDuration(olderRuns);
      
      if (recentAvgDuration > olderAvgDuration * 1.5) {
        issues.push({
          type: 'performance_degradation',
          severity: 'medium',
          message: 'Dégradation des performances détectée',
          recommendation: 'Analyser les changements récents qui pourraient impacter les performances'
        });
      }
    }

    return issues;
  }

  calculateAverageDuration(runs) {
    const durations = runs
      .filter(run => run.created_at && run.updated_at)
      .map(run => new Date(run.updated_at) - new Date(run.created_at));
    
    return durations.length > 0 ? _.mean(durations) : 0;
  }

  analyzeFailurePatterns(allRuns, currentRun) {
    const recentRuns = allRuns.slice(0, 10);
    const failures = recentRuns.filter(run => 
      run.conclusion === 'failure' || run.conclusion === 'cancelled'
    );
    
    return {
      isRecurrent: failures.length >= 3,
      count: failures.length,
      rate: failures.length / recentRuns.length
    };
  }

  calculateSuccessRate(runs) {
    const successful = runs.filter(run => run.conclusion === 'success').length;
    return runs.length > 0 ? (successful / runs.length) * 100 : 0;
  }

  async findSuspiciousPatterns(workflowContent) {
    const issues = [];
    
    if (!workflowContent) {
      return { issues };
    }

    try {
      // Parse du YAML
      const workflow = yaml.load(workflowContent);
      
      // Analyse du contenu brut pour les patterns regex
      for (const [patternName, pattern] of Object.entries(this.suspiciousPatterns)) {
        const matches = workflowContent.match(pattern);
        if (matches) {
          issues.push({
            type: 'suspicious_pattern',
            pattern: patternName,
            severity: this.getPatternSeverity(patternName),
            message: `Pattern suspect détecté: ${patternName}`,
            matches: matches.length,
            recommendation: this.getPatternRecommendation(patternName)
          });
        }
      }

      // Analyse structurelle du workflow
      if (workflow) {
        const structuralIssues = this.analyzeWorkflowStructure(workflow);
        issues.push(...structuralIssues);
      }

    } catch (error) {
      issues.push({
        type: 'yaml_parse_error',
        severity: 'medium',
        message: `Erreur de parsing YAML: ${error.message}`,
        recommendation: 'Vérifier la syntaxe YAML du workflow'
      });
    }

    return { issues };
  }

  analyzeWorkflowStructure(workflow) {
    const issues = [];

    // Vérification des permissions
    if (workflow.permissions) {
      if (workflow.permissions === 'write-all' || 
          (typeof workflow.permissions === 'object' && 
           Object.values(workflow.permissions).includes('write'))) {
        issues.push({
          type: 'excessive_permissions',
          severity: 'high',
          message: 'Permissions excessives détectées',
          recommendation: 'Utiliser le principe du moindre privilège pour les permissions'
        });
      }
    }

    // Analyse des jobs
    if (workflow.jobs) {
      for (const [jobName, job] of Object.entries(workflow.jobs)) {
        // Vérification des runners non sécurisés
        if (job['runs-on'] && typeof job['runs-on'] === 'string' && 
            job['runs-on'].includes('self-hosted')) {
          issues.push({
            type: 'self_hosted_runner',
            severity: 'medium',
            job: jobName,
            message: 'Utilisation de runners self-hosted détectée',
            recommendation: 'S\'assurer que les runners self-hosted sont sécurisés'
          });
        }

        // Analyse des steps
        if (job.steps) {
          const stepIssues = this.analyzeSteps(job.steps, jobName);
          issues.push(...stepIssues);
        }
      }
    }

    return issues;
  }

  analyzeSteps(steps, jobName) {
    const issues = [];

    for (const [index, step] of steps.entries()) {
      // Vérification des actions non versionnées
      if (step.uses && !step.uses.includes('@')) {
        issues.push({
          type: 'unversioned_action',
          severity: 'medium',
          job: jobName,
          step: index,
          action: step.uses,
          message: 'Action sans version spécifique détectée',
          recommendation: 'Toujours spécifier une version pour les actions externes'
        });
      }

      // Vérification des commandes shell dangereuses
      if (step.run) {
        const dangerousCommands = this.findDangerousCommands(step.run);
        if (dangerousCommands.length > 0) {
          issues.push({
            type: 'dangerous_command',
            severity: 'high',
            job: jobName,
            step: index,
            commands: dangerousCommands,
            message: 'Commandes potentiellement dangereuses détectées',
            recommendation: 'Éviter les commandes qui peuvent compromettre la sécurité'
          });
        }
      }
    }

    return issues;
  }

  findDangerousCommands(command) {
    const dangerous = [];
    const dangerousPatterns = [
      /curl.*\|\s*bash/gi,
      /wget.*\|\s*sh/gi,
      /eval\s*\$/gi,
      /rm\s+-rf\s+\//gi,
      /chmod\s+777/gi
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        dangerous.push(pattern.source);
      }
    }

    return dangerous;
  }

  async analyzeLogs(logs) {
    const issues = [];
    
    if (!logs || typeof logs !== 'string') {
      return { issues };
    }

    const lines = logs.split('\n');

    for (const [lineNumber, line] of lines.entries()) {
      // Détection d'erreurs cachées
      const lowerLine = line.toLowerCase();
      for (const keyword of this.criticalKeywords) {
        if (lowerLine.includes(keyword) && !this.isExpectedError(line)) {
          issues.push({
            type: 'hidden_error',
            severity: 'medium',
            line: lineNumber + 1,
            content: line.trim(),
            keyword: keyword,
            message: `Erreur potentielle détectée dans les logs: ${keyword}`,
            recommendation: 'Vérifier si cette erreur devrait faire échouer le job'
          });
        }
      }

      // Détection de secrets exposés
      for (const pattern of this.secretPatterns) {
        const matches = line.match(pattern);
        if (matches) {
          issues.push({
            type: 'exposed_secret',
            severity: 'critical',
            line: lineNumber + 1,
            message: 'Secret potentiellement exposé dans les logs',
            recommendation: 'Utiliser des secrets GitHub et éviter de logger des informations sensibles'
          });
        }
      }

      // Détection de warnings ignorés
      if (lowerLine.includes('warning') && !this.isAcknowledgedWarning(line)) {
        issues.push({
          type: 'ignored_warning',
          severity: 'low',
          line: lineNumber + 1,
          content: line.trim(),
          message: 'Warning potentiellement ignoré',
          recommendation: 'Évaluer si ce warning nécessite une action'
        });
      }
    }

    return { issues };
  }

  isExpectedError(line) {
    // Logique pour déterminer si une erreur est attendue/gérée
    const expectedPatterns = [
      /expected.*error/gi,
      /test.*error/gi,
      /mock.*error/gi
    ];
    
    return expectedPatterns.some(pattern => pattern.test(line));
  }

  isAcknowledgedWarning(line) {
    // Logique pour déterminer si un warning est reconnu/géré
    return line.includes('# warning acknowledged') || 
           line.includes('# expected warning');
  }

  calculateRiskScore(issues) {
    let score = 0;
    const weights = {
      critical: 25,
      high: 15,
      medium: 8,
      low: 3
    };

    for (const issue of issues) {
      score += weights[issue.severity] || 0;
    }

    // Normalisation sur 100
    return Math.min(score, 100);
  }

  generateRecommendations(issues) {
    const recommendations = [];
    const issueTypes = _.groupBy(issues, 'type');

    // Recommandations basées sur les types d'issues
    if (issueTypes.exposed_secret) {
      recommendations.push({
        priority: 'critical',
        category: 'security',
        title: 'Gestion des secrets',
        description: 'Utiliser GitHub Secrets pour toutes les informations sensibles',
        actions: [
          'Migrer tous les secrets vers GitHub Secrets',
          'Auditer les logs pour identifier les expositions passées',
          'Implémenter une politique de rotation des secrets'
        ]
      });
    }

    if (issueTypes.hidden_failure) {
      recommendations.push({
        priority: 'high',
        category: 'reliability',
        title: 'Échecs masqués',
        description: 'Éliminer les échecs silencieux qui compromettent la fiabilité',
        actions: [
          'Revoir l\'utilisation de continue-on-error',
          'Implémenter des vérifications de santé explicites',
          'Ajouter des notifications pour les échecs partiels'
        ]
      });
    }

    if (issueTypes.performance_degradation) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        title: 'Optimisation des performances',
        description: 'Améliorer les temps d\'exécution des workflows',
        actions: [
          'Analyser les étapes les plus lentes',
          'Optimiser les dépendances et le cache',
          'Considérer la parallélisation des tâches'
        ]
      });
    }

    return recommendations;
  }

  getPatternSeverity(patternName) {
    const severityMap = {
      continueOnError: 'medium',
      ignoreErrors: 'high',
      skipTests: 'medium',
      unsafeShell: 'high',
      hardcodedSecrets: 'critical',
      unsafeDownloads: 'critical',
      privilegedMode: 'high'
    };
    
    return severityMap[patternName] || 'medium';
  }

  getPatternRecommendation(patternName) {
    const recommendations = {
      continueOnError: 'Éviter continue-on-error sauf si absolument nécessaire',
      ignoreErrors: 'Gérer explicitement les erreurs au lieu de les ignorer',
      skipTests: 'S\'assurer que les tests sautés sont intentionnels et documentés',
      unsafeShell: 'Éviter l\'injection de variables non validées dans les commandes shell',
      hardcodedSecrets: 'Utiliser GitHub Secrets pour toutes les informations sensibles',
      unsafeDownloads: 'Éviter de télécharger et exécuter des scripts non vérifiés',
      privilegedMode: 'Utiliser le mode privilégié uniquement si nécessaire'
    };
    
    return recommendations[patternName] || 'Revoir cette configuration pour s\'assurer qu\'elle est sécurisée';
  }
}

module.exports = ForensicAnalyzer;

