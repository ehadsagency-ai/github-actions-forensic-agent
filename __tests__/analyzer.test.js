const ForensicAnalyzer = require('../src/analyzer');

describe('ForensicAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new ForensicAnalyzer();
  });

  describe('analyzeWorkflowRuns', () => {
    test('devrait analyser les runs de workflow correctement', async () => {
      const mockRuns = [
        {
          id: 1,
          name: 'Test Workflow',
          conclusion: 'success',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:05:00Z'
        },
        {
          id: 2,
          name: 'Test Workflow',
          conclusion: 'failure',
          created_at: '2025-01-01T01:00:00Z',
          updated_at: '2025-01-01T01:03:00Z'
        }
      ];

      const result = await analyzer.analyzeWorkflowRuns(mockRuns);

      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('hiddenFailures');
      expect(result).toHaveProperty('totalRuns', 2);
      expect(result).toHaveProperty('successRate');
      expect(Array.isArray(result.issues)).toBe(true);
    });

    test('devrait calculer le taux de succès correctement', async () => {
      const mockRuns = [
        { conclusion: 'success' },
        { conclusion: 'success' },
        { conclusion: 'failure' },
        { conclusion: 'success' }
      ];

      const result = await analyzer.analyzeWorkflowRuns(mockRuns);
      expect(result.successRate).toBe(75);
    });
  });

  describe('findSuspiciousPatterns', () => {
    test('devrait détecter continue-on-error', async () => {
      const workflowContent = `
name: Test
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Test step
        run: echo "test"
        continue-on-error: true
      `;

      const result = await analyzer.findSuspiciousPatterns(workflowContent);
      
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].pattern).toBe('continueOnError');
      expect(result.issues[0].type).toBe('suspicious_pattern');
    });

    test('devrait détecter les secrets hardcodés', async () => {
      const workflowContent = `
name: Test
env:
  API_KEY: "sk-1234567890abcdef"
  PASSWORD: 'mysecretpassword'
      `;

      const result = await analyzer.findSuspiciousPatterns(workflowContent);
      
      const secretIssues = result.issues.filter(issue => issue.pattern === 'hardcodedSecrets');
      expect(secretIssues.length).toBeGreaterThan(0);
    });

    test('devrait gérer les erreurs de parsing YAML', async () => {
      const invalidYaml = `
name: Test
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Test
        run: echo "test"
      invalid_yaml_here
      `;

      const result = await analyzer.findSuspiciousPatterns(invalidYaml);
      
      const parseErrors = result.issues.filter(issue => issue.type === 'yaml_parse_error');
      expect(parseErrors.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeLogs', () => {
    test('devrait détecter les erreurs cachées dans les logs', async () => {
      const logs = `
2025-01-01T00:00:00.000Z Starting job
2025-01-01T00:00:01.000Z Running tests
2025-01-01T00:00:02.000Z ERROR: Test failed but continuing
2025-01-01T00:00:03.000Z Job completed successfully
      `;

      const result = await analyzer.analyzeLogs(logs);
      
      const hiddenErrors = result.issues.filter(issue => issue.type === 'hidden_error');
      expect(hiddenErrors.length).toBeGreaterThan(0);
      expect(hiddenErrors[0].keyword).toBe('error');
    });

    test('devrait détecter les secrets exposés dans les logs', async () => {
      const logs = `
2025-01-01T00:00:00.000Z Starting deployment
2025-01-01T00:00:01.000Z Using API_KEY: sk-1234567890abcdef
2025-01-01T00:00:02.000Z Deployment completed
      `;

      const result = await analyzer.analyzeLogs(logs);
      
      const exposedSecrets = result.issues.filter(issue => issue.type === 'exposed_secret');
      expect(exposedSecrets.length).toBeGreaterThan(0);
      expect(exposedSecrets[0].severity).toBe('critical');
    });

    test('devrait ignorer les erreurs attendues', async () => {
      const logs = `
2025-01-01T00:00:00.000Z Running test that expects error
2025-01-01T00:00:01.000Z Expected error occurred in test
2025-01-01T00:00:02.000Z Test completed successfully
      `;

      const result = await analyzer.analyzeLogs(logs);
      
      // Les erreurs "expected" ne devraient pas être signalées
      const hiddenErrors = result.issues.filter(issue => 
        issue.type === 'hidden_error' && issue.content.includes('Expected error')
      );
      expect(hiddenErrors.length).toBe(0);
    });
  });

  describe('calculateRiskScore', () => {
    test('devrait calculer un score de risque basé sur la sévérité', () => {
      const issues = [
        { severity: 'critical' },
        { severity: 'critical' },
        { severity: 'high' },
        { severity: 'medium' },
        { severity: 'low' }
      ];

      const score = analyzer.calculateRiskScore(issues);
      
      // 2 * 25 + 1 * 15 + 1 * 8 + 1 * 3 = 76
      expect(score).toBe(76);
    });

    test('devrait limiter le score à 100', () => {
      const issues = Array(10).fill({ severity: 'critical' });
      
      const score = analyzer.calculateRiskScore(issues);
      expect(score).toBe(100);
    });

    test('devrait retourner 0 pour aucun problème', () => {
      const score = analyzer.calculateRiskScore([]);
      expect(score).toBe(0);
    });
  });

  describe('generateRecommendations', () => {
    test('devrait générer des recommandations pour les secrets exposés', () => {
      const issues = [
        { type: 'exposed_secret', severity: 'critical' }
      ];

      const recommendations = analyzer.generateRecommendations(issues);
      
      expect(recommendations.length).toBeGreaterThan(0);
      const secretRec = recommendations.find(r => r.category === 'security');
      expect(secretRec).toBeDefined();
      expect(secretRec.priority).toBe('critical');
    });

    test('devrait générer des recommandations pour les échecs cachés', () => {
      const issues = [
        { type: 'hidden_failure', severity: 'high' }
      ];

      const recommendations = analyzer.generateRecommendations(issues);
      
      const reliabilityRec = recommendations.find(r => r.category === 'reliability');
      expect(reliabilityRec).toBeDefined();
      expect(reliabilityRec.priority).toBe('high');
    });
  });

  describe('analyzeWorkflowStructure', () => {
    test('devrait détecter les permissions excessives', () => {
      const workflow = {
        permissions: 'write-all',
        jobs: {
          test: {
            'runs-on': 'ubuntu-latest'
          }
        }
      };

      const issues = analyzer.analyzeWorkflowStructure(workflow);
      
      const permissionIssues = issues.filter(issue => issue.type === 'excessive_permissions');
      expect(permissionIssues.length).toBeGreaterThan(0);
      expect(permissionIssues[0].severity).toBe('high');
    });

    test('devrait détecter les runners self-hosted', () => {
      const workflow = {
        jobs: {
          test: {
            'runs-on': 'self-hosted'
          }
        }
      };

      const issues = analyzer.analyzeWorkflowStructure(workflow);
      
      const runnerIssues = issues.filter(issue => issue.type === 'self_hosted_runner');
      expect(runnerIssues.length).toBeGreaterThan(0);
      expect(runnerIssues[0].job).toBe('test');
    });
  });

  describe('findDangerousCommands', () => {
    test('devrait détecter curl | bash', () => {
      const command = 'curl -sSL https://example.com/script.sh | bash';
      
      const dangerous = analyzer.findDangerousCommands(command);
      expect(dangerous.length).toBeGreaterThan(0);
    });

    test('devrait détecter rm -rf /', () => {
      const command = 'rm -rf /tmp/something';
      
      const dangerous = analyzer.findDangerousCommands(command);
      expect(dangerous.length).toBeGreaterThan(0);
    });

    test('devrait détecter chmod 777', () => {
      const command = 'chmod 777 /some/file';
      
      const dangerous = analyzer.findDangerousCommands(command);
      expect(dangerous.length).toBeGreaterThan(0);
    });
  });
});

