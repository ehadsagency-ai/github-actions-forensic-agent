const ReportGenerator = require('../src/reporter');
const fs = require('fs').promises;

// Mock fs
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn()
  }
}));

describe('ReportGenerator', () => {
  let reporter;
  let mockAnalysis;

  beforeEach(() => {
    reporter = new ReportGenerator();
    mockAnalysis = {
      repository: 'test-owner/test-repo',
      timestamp: '2025-01-01T00:00:00.000Z',
      summary: {
        totalWorkflows: 5,
        totalIssues: 10,
        hiddenFailures: 2,
        criticalIssues: 1,
        riskScore: 45
      },
      workflows: ['workflow1', 'workflow2'],
      issues: [
        {
          type: 'hidden_failure',
          severity: 'high',
          message: 'Test hidden failure',
          workflow: 'test-workflow',
          recommendation: 'Fix the issue'
        },
        {
          type: 'exposed_secret',
          severity: 'critical',
          message: 'Secret exposed',
          recommendation: 'Use GitHub secrets'
        }
      ],
      criticalIssues: [
        {
          type: 'exposed_secret',
          severity: 'critical',
          message: 'Secret exposed',
          recommendation: 'Use GitHub secrets'
        }
      ],
      recommendations: [
        {
          priority: 'critical',
          category: 'security',
          title: 'Fix secrets',
          description: 'Use proper secret management',
          actions: ['Action 1', 'Action 2']
        }
      ]
    };

    // Reset mocks
    fs.writeFile.mockClear();
  });

  describe('generateMarkdownReport', () => {
    test('devrait générer un rapport Markdown complet', () => {
      const report = reporter.generateMarkdownReport(mockAnalysis);

      expect(report).toContain('# 🔍 Rapport d\'Analyse Forensique GitHub Actions');
      expect(report).toContain('test-owner/test-repo');
      expect(report).toContain('## 📊 Résumé Exécutif');
      expect(report).toContain('## 📈 Score de Risque Global');
      expect(report).toContain('## 🚨 Problèmes Critiques');
      expect(report).toContain('## 💡 Recommandations');
    });

    test('devrait inclure les métriques dans le résumé', () => {
      const report = reporter.generateMarkdownReport(mockAnalysis);

      expect(report).toContain('| 🔧 Workflows analysés | 5 |');
      expect(report).toContain('| 🔍 Problèmes détectés | 10 |');
      expect(report).toContain('| 👻 Échecs cachés | 2 |');
      expect(report).toContain('| 🚨 Problèmes critiques | 1 |');
      expect(report).toContain('| 📊 Score de risque | 45/100 |');
    });

    test('devrait interpréter correctement le score de risque', () => {
      const report = reporter.generateMarkdownReport(mockAnalysis);
      expect(report).toContain('**RISQUE MODÉRÉ**');
    });

    test('devrait inclure les problèmes critiques si présents', () => {
      const report = reporter.generateMarkdownReport(mockAnalysis);
      expect(report).toContain('🚨 EXPOSED_SECRET');
      expect(report).toContain('Secret exposed');
    });

    test('devrait ne pas inclure la section critiques si aucun problème critique', () => {
      const analysisWithoutCritical = {
        ...mockAnalysis,
        criticalIssues: []
      };

      const report = reporter.generateMarkdownReport(analysisWithoutCritical);
      expect(report).not.toContain('## 🚨 Problèmes Critiques');
    });
  });

  describe('generateJSONReport', () => {
    test('devrait générer un rapport JSON valide', () => {
      const jsonReport = reporter.generateJSONReport(mockAnalysis);
      const parsed = JSON.parse(jsonReport);

      expect(parsed).toHaveProperty('metadata');
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('issues');
      expect(parsed).toHaveProperty('critical_issues');
      expect(parsed).toHaveProperty('recommendations');
      expect(parsed).toHaveProperty('metrics');
    });

    test('devrait inclure les métadonnées correctes', () => {
      const jsonReport = reporter.generateJSONReport(mockAnalysis);
      const parsed = JSON.parse(jsonReport);

      expect(parsed.metadata.version).toBe('1.0.0');
      expect(parsed.metadata.repository).toBe('test-owner/test-repo');
      expect(parsed.metadata.generator).toBe('github-actions-forensic-agent');
    });

    test('devrait ajouter des IDs uniques aux problèmes', () => {
      const jsonReport = reporter.generateJSONReport(mockAnalysis);
      const parsed = JSON.parse(jsonReport);

      expect(parsed.issues[0]).toHaveProperty('id');
      expect(parsed.issues[0]).toHaveProperty('timestamp');
      expect(typeof parsed.issues[0].id).toBe('string');
      expect(parsed.issues[0].id).toHaveLength(8);
    });

    test('devrait inclure les métriques de risque', () => {
      const jsonReport = reporter.generateJSONReport(mockAnalysis);
      const parsed = JSON.parse(jsonReport);

      expect(parsed.metrics.risk_assessment).toHaveProperty('score', 45);
      expect(parsed.metrics.risk_assessment).toHaveProperty('level', 'medium');
      expect(parsed.metrics.risk_assessment).toHaveProperty('factors');
    });
  });

  describe('generateAnnotations', () => {
    test('devrait générer des annotations pour les problèmes critiques', () => {
      const annotations = reporter.generateAnnotations(mockAnalysis.criticalIssues);

      expect(annotations).toHaveLength(1);
      expect(annotations[0]).toHaveProperty('title');
      expect(annotations[0]).toHaveProperty('message');
      expect(annotations[0]).toHaveProperty('level', 'failure');
      expect(annotations[0].title).toContain('🚨 Problème Critique');
    });

    test('devrait définir le bon chemin pour les annotations', () => {
      const annotations = reporter.generateAnnotations(mockAnalysis.criticalIssues);

      expect(annotations[0].path).toContain('.github/workflows/');
    });
  });

  describe('saveReport', () => {
    test('devrait sauvegarder le rapport avec fs.writeFile', async () => {
      fs.writeFile.mockResolvedValue();

      const content = 'Test report content';
      const filename = 'test-report.md';

      const result = await reporter.saveReport(content, filename);

      expect(fs.writeFile).toHaveBeenCalledWith(filename, content, 'utf8');
      expect(result).toContain(filename);
    });

    test('devrait gérer les erreurs de sauvegarde', async () => {
      fs.writeFile.mockRejectedValue(new Error('Permission denied'));

      const content = 'Test content';
      const filename = 'test-report.md';

      await expect(reporter.saveReport(content, filename))
        .rejects.toThrow('Erreur lors de la sauvegarde du rapport');
    });
  });

  describe('interpretRiskScore', () => {
    test('devrait interpréter un score critique (>= 80)', () => {
      const interpretation = reporter.interpretRiskScore(85);
      expect(interpretation).toContain('🚨 **RISQUE CRITIQUE**');
    });

    test('devrait interpréter un score élevé (>= 60)', () => {
      const interpretation = reporter.interpretRiskScore(70);
      expect(interpretation).toContain('⚠️ **RISQUE ÉLEVÉ**');
    });

    test('devrait interpréter un score modéré (>= 30)', () => {
      const interpretation = reporter.interpretRiskScore(45);
      expect(interpretation).toContain('⚡ **RISQUE MODÉRÉ**');
    });

    test('devrait interpréter un score faible (< 30)', () => {
      const interpretation = reporter.interpretRiskScore(15);
      expect(interpretation).toContain('💡 **RISQUE FAIBLE**');
    });
  });

  describe('generateRiskScoreVisualization', () => {
    test('devrait générer une barre de progression ASCII', () => {
      const visualization = reporter.generateRiskScoreVisualization(50);

      expect(visualization).toContain('Score: 50/100');
      expect(visualization).toContain('█');
      expect(visualization).toContain('░');
      expect(visualization).toContain('50%');
    });

    test('devrait gérer un score de 0', () => {
      const visualization = reporter.generateRiskScoreVisualization(0);
      expect(visualization).toContain('░'.repeat(20));
    });

    test('devrait gérer un score de 100', () => {
      const visualization = reporter.generateRiskScoreVisualization(100);
      expect(visualization).toContain('█'.repeat(20));
    });
  });

  describe('groupIssuesBySeverity', () => {
    test('devrait grouper les problèmes par sévérité', () => {
      const issues = [
        { severity: 'critical' },
        { severity: 'high' },
        { severity: 'critical' },
        { severity: 'medium' },
        { severity: 'low' }
      ];

      const grouped = reporter.groupIssuesBySeverity(issues);

      expect(grouped.critical).toHaveLength(2);
      expect(grouped.high).toHaveLength(1);
      expect(grouped.medium).toHaveLength(1);
      expect(grouped.low).toHaveLength(1);
    });

    test('devrait gérer les sévérités manquantes', () => {
      const issues = [
        { severity: 'critical' },
        { /* pas de severity */ }
      ];

      const grouped = reporter.groupIssuesBySeverity(issues);

      expect(grouped.critical).toHaveLength(1);
      expect(grouped.medium).toHaveLength(1); // défaut
    });
  });

  describe('getRiskLevel', () => {
    test('devrait retourner le bon niveau de risque', () => {
      expect(reporter.getRiskLevel(85)).toBe('critical');
      expect(reporter.getRiskLevel(70)).toBe('high');
      expect(reporter.getRiskLevel(45)).toBe('medium');
      expect(reporter.getRiskLevel(15)).toBe('low');
    });
  });

  describe('getRiskFactors', () => {
    test('devrait identifier les facteurs de risque', () => {
      const issues = [
        { severity: 'critical', type: 'exposed_secret' },
        { severity: 'critical', type: 'other' },
        { severity: 'high', type: 'hidden_failure' }
      ];

      const factors = reporter.getRiskFactors(issues);

      expect(factors).toContain('2 problèmes critiques détectés');
      expect(factors).toContain('Secrets potentiellement exposés');
      expect(factors).toContain('Échecs masqués détectés');
    });

    test('devrait gérer l\'absence de facteurs de risque', () => {
      const issues = [
        { severity: 'low', type: 'minor_issue' }
      ];

      const factors = reporter.getRiskFactors(issues);
      expect(factors).toHaveLength(0);
    });
  });
});

