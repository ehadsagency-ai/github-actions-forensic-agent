const fs = require('fs').promises;
const path = require('path');

class ReportGenerator {
  constructor() {
    this.severityEmojis = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: '💡'
    };

    this.severityColors = {
      critical: '#FF0000',
      high: '#FF6600',
      medium: '#FFAA00',
      low: '#00AA00'
    };
  }

  generateMarkdownReport(analysis) {
    const { repository, timestamp, summary, issues, criticalIssues, recommendations } = analysis;
    
    let report = `# 🔍 Rapport d'Analyse Forensique GitHub Actions\n\n`;
    
    // En-tête avec métadonnées
    report += `**Dépôt:** \`${repository}\`  \n`;
    report += `**Date d'analyse:** ${new Date(timestamp).toLocaleString('fr-FR')}  \n`;
    report += `**Version de l'agent:** 1.0.0\n\n`;
    
    // Résumé exécutif
    report += `## 📊 Résumé Exécutif\n\n`;
    report += this.generateExecutiveSummary(summary);
    
    // Score de risque avec visualisation
    report += `## 📈 Score de Risque Global\n\n`;
    report += this.generateRiskScoreVisualization(summary.riskScore);
    
    // Problèmes critiques
    if (criticalIssues.length > 0) {
      report += `## 🚨 Problèmes Critiques (Action Immédiate Requise)\n\n`;
      report += this.generateIssuesSection(criticalIssues);
    }
    
    // Tous les problèmes par sévérité
    report += `## 📋 Détail des Problèmes\n\n`;
    report += this.generateDetailedIssuesSection(issues);
    
    // Recommandations
    if (recommendations && recommendations.length > 0) {
      report += `## 💡 Recommandations\n\n`;
      report += this.generateRecommendationsSection(recommendations);
    }
    
    // Métriques et tendances
    report += `## 📊 Métriques et Tendances\n\n`;
    report += this.generateMetricsSection(analysis);
    
    // Actions suivantes
    report += `## 🎯 Actions Suivantes Recommandées\n\n`;
    report += this.generateNextActionsSection(issues, criticalIssues);
    
    // Footer
    report += `\n---\n\n`;
    report += `*Rapport généré par GitHub Actions Forensic Agent v1.0.0*  \n`;
    report += `*Pour plus d'informations, consultez la [documentation](https://github.com/votre-repo/github-actions-forensic-agent)*\n`;
    
    return report;
  }

  generateExecutiveSummary(summary) {
    let section = `| Métrique | Valeur |\n`;
    section += `|----------|--------|\n`;
    section += `| 🔧 Workflows analysés | ${summary.totalWorkflows} |\n`;
    section += `| 🔍 Problèmes détectés | ${summary.totalIssues} |\n`;
    section += `| 👻 Échecs cachés | ${summary.hiddenFailures} |\n`;
    section += `| 🚨 Problèmes critiques | ${summary.criticalIssues} |\n`;
    section += `| 📊 Score de risque | ${summary.riskScore}/100 |\n\n`;
    
    // Interprétation du score
    section += this.interpretRiskScore(summary.riskScore);
    
    return section;
  }

  interpretRiskScore(score) {
    let interpretation = `### Interprétation du Score de Risque\n\n`;
    
    if (score >= 80) {
      interpretation += `🚨 **RISQUE CRITIQUE** (${score}/100): Votre infrastructure CI/CD présente des vulnérabilités majeures qui nécessitent une attention immédiate.\n\n`;
    } else if (score >= 60) {
      interpretation += `⚠️ **RISQUE ÉLEVÉ** (${score}/100): Plusieurs problèmes de sécurité et de fiabilité ont été identifiés et doivent être corrigés rapidement.\n\n`;
    } else if (score >= 30) {
      interpretation += `⚡ **RISQUE MODÉRÉ** (${score}/100): Quelques améliorations sont recommandées pour optimiser la sécurité et la fiabilité.\n\n`;
    } else {
      interpretation += `💡 **RISQUE FAIBLE** (${score}/100): Votre configuration est globalement saine, avec quelques optimisations mineures possibles.\n\n`;
    }
    
    return interpretation;
  }

  generateRiskScoreVisualization(score) {
    const barLength = 20;
    const filledLength = Math.round((score / 100) * barLength);
    const emptyLength = barLength - filledLength;
    
    let visualization = `\`\`\`\n`;
    visualization += `Score: ${score}/100\n`;
    visualization += `[${'█'.repeat(filledLength)}${'░'.repeat(emptyLength)}] ${score}%\n`;
    visualization += `\`\`\`\n\n`;
    
    return visualization;
  }

  generateIssuesSection(issues) {
    let section = '';
    
    for (const issue of issues) {
      const emoji = this.severityEmojis[issue.severity] || '❓';
      section += `### ${emoji} ${issue.type.replace(/_/g, ' ').toUpperCase()}\n\n`;
      section += `**Message:** ${issue.message}\n\n`;
      
      if (issue.workflow) {
        section += `**Workflow:** \`${issue.workflow}\`\n\n`;
      }
      
      if (issue.recommendation) {
        section += `**Recommandation:** ${issue.recommendation}\n\n`;
      }
      
      section += `---\n\n`;
    }
    
    return section;
  }

  generateDetailedIssuesSection(issues) {
    const issuesBySeverity = this.groupIssuesBySeverity(issues);
    let section = '';
    
    for (const severity of ['critical', 'high', 'medium', 'low']) {
      const severityIssues = issuesBySeverity[severity] || [];
      if (severityIssues.length === 0) continue;
      
      const emoji = this.severityEmojis[severity];
      section += `### ${emoji} ${severity.toUpperCase()} (${severityIssues.length})\n\n`;
      
      for (const issue of severityIssues) {
        section += `- **${issue.type.replace(/_/g, ' ')}**: ${issue.message}\n`;
        if (issue.workflow) {
          section += `  - Workflow: \`${issue.workflow}\`\n`;
        }
        if (issue.recommendation) {
          section += `  - Action: ${issue.recommendation}\n`;
        }
      }
      
      section += `\n`;
    }
    
    return section;
  }

  groupIssuesBySeverity(issues) {
    const grouped = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };
    
    for (const issue of issues) {
      const severity = issue.severity || 'medium';
      if (grouped[severity]) {
        grouped[severity].push(issue);
      }
    }
    
    return grouped;
  }

  generateRecommendationsSection(recommendations) {
    let section = '';
    
    // Tri par priorité
    const sortedRecommendations = recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    for (const rec of sortedRecommendations) {
      const emoji = this.severityEmojis[rec.priority] || '💡';
      section += `### ${emoji} ${rec.title}\n\n`;
      section += `**Priorité:** ${rec.priority.toUpperCase()}  \n`;
      section += `**Catégorie:** ${rec.category}\n\n`;
      section += `${rec.description}\n\n`;
      
      if (rec.actions && rec.actions.length > 0) {
        section += `**Actions recommandées:**\n`;
        for (const action of rec.actions) {
          section += `- ${action}\n`;
        }
        section += `\n`;
      }
      
      section += `---\n\n`;
    }
    
    return section;
  }

  generateMetricsSection(analysis) {
    let section = `### 📊 Répartition des Problèmes par Type\n\n`;
    
    const issueTypes = {};
    for (const issue of analysis.issues) {
      issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
    }
    
    const sortedTypes = Object.entries(issueTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10); // Top 10
    
    section += `| Type de Problème | Occurrences |\n`;
    section += `|------------------|-------------|\n`;
    
    for (const [type, count] of sortedTypes) {
      section += `| ${type.replace(/_/g, ' ')} | ${count} |\n`;
    }
    
    section += `\n### 📈 Répartition par Sévérité\n\n`;
    
    const severityCounts = this.groupIssuesBySeverity(analysis.issues);
    section += `| Sévérité | Nombre | Pourcentage |\n`;
    section += `|----------|--------|-------------|\n`;
    
    const total = analysis.issues.length;
    for (const [severity, issues] of Object.entries(severityCounts)) {
      const count = issues.length;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      const emoji = this.severityEmojis[severity];
      section += `| ${emoji} ${severity} | ${count} | ${percentage}% |\n`;
    }
    
    return section + `\n`;
  }

  generateNextActionsSection(issues, criticalIssues) {
    let section = '';
    
    if (criticalIssues.length > 0) {
      section += `### 🚨 Actions Immédiates (0-24h)\n\n`;
      section += `1. **Corriger les problèmes critiques** - ${criticalIssues.length} problèmes nécessitent une attention immédiate\n`;
      section += `2. **Auditer les secrets exposés** - Vérifier et faire tourner tous les secrets potentiellement compromis\n`;
      section += `3. **Notifier l'équipe de sécurité** - Informer les responsables des vulnérabilités critiques\n\n`;
    }
    
    section += `### ⚡ Actions à Court Terme (1-7 jours)\n\n`;
    section += `1. **Revoir les configurations de workflow** - Analyser et corriger les patterns suspects\n`;
    section += `2. **Implémenter des tests de sécurité** - Ajouter des vérifications automatisées\n`;
    section += `3. **Former l'équipe** - Sensibiliser aux bonnes pratiques de sécurité CI/CD\n\n`;
    
    section += `### 📊 Actions à Long Terme (1-4 semaines)\n\n`;
    section += `1. **Automatiser l'analyse forensique** - Intégrer cet agent dans vos workflows réguliers\n`;
    section += `2. **Établir des métriques de sécurité** - Suivre l'évolution du score de risque\n`;
    section += `3. **Créer une politique de sécurité CI/CD** - Documenter les standards et procédures\n\n`;
    
    return section;
  }

  generateJSONReport(analysis) {
    const report = {
      metadata: {
        version: '1.0.0',
        repository: analysis.repository,
        timestamp: analysis.timestamp,
        generator: 'github-actions-forensic-agent'
      },
      summary: analysis.summary,
      issues: analysis.issues.map(issue => ({
        ...issue,
        id: this.generateIssueId(issue),
        timestamp: new Date().toISOString()
      })),
      critical_issues: analysis.criticalIssues,
      recommendations: analysis.recommendations || [],
      metrics: {
        issues_by_severity: this.groupIssuesBySeverity(analysis.issues),
        issues_by_type: this.getIssueTypeDistribution(analysis.issues),
        risk_assessment: {
          score: analysis.summary.riskScore,
          level: this.getRiskLevel(analysis.summary.riskScore),
          factors: this.getRiskFactors(analysis.issues)
        }
      }
    };
    
    return JSON.stringify(report, null, 2);
  }

  generateIssueId(issue) {
    // Génère un ID unique pour chaque problème
    const hash = require('crypto')
      .createHash('md5')
      .update(`${issue.type}-${issue.message}-${issue.workflow || ''}`)
      .digest('hex');
    return hash.substring(0, 8);
  }

  getIssueTypeDistribution(issues) {
    const distribution = {};
    for (const issue of issues) {
      distribution[issue.type] = (distribution[issue.type] || 0) + 1;
    }
    return distribution;
  }

  getRiskLevel(score) {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  getRiskFactors(issues) {
    const factors = [];
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const highIssues = issues.filter(i => i.severity === 'high');
    
    if (criticalIssues.length > 0) {
      factors.push(`${criticalIssues.length} problèmes critiques détectés`);
    }
    
    if (highIssues.length > 5) {
      factors.push(`Nombre élevé de problèmes de haute sévérité (${highIssues.length})`);
    }
    
    const secretIssues = issues.filter(i => i.type === 'exposed_secret');
    if (secretIssues.length > 0) {
      factors.push('Secrets potentiellement exposés');
    }
    
    const hiddenFailures = issues.filter(i => i.type === 'hidden_failure');
    if (hiddenFailures.length > 0) {
      factors.push('Échecs masqués détectés');
    }
    
    return factors;
  }

  generateAnnotations(criticalIssues) {
    return criticalIssues.map(issue => ({
      title: `🚨 Problème Critique: ${issue.type.replace(/_/g, ' ')}`,
      message: issue.message,
      level: 'failure',
      path: issue.workflow ? `.github/workflows/${issue.workflow}` : '.github/workflows/',
      start_line: issue.line || 1,
      end_line: issue.line || 1
    }));
  }

  async saveReport(content, filename) {
    try {
      await fs.writeFile(filename, content, 'utf8');
      return path.resolve(filename);
    } catch (error) {
      throw new Error(`Erreur lors de la sauvegarde du rapport ${filename}: ${error.message}`);
    }
  }
}

module.exports = ReportGenerator;

