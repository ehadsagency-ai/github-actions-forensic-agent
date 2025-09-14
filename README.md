# 🔍 GitHub Actions Deep Forensic Agent

[![Build Status](https://github.com/votre-username/github-actions-forensic-agent/workflows/Test/badge.svg)](https://github.com/votre-username/github-actions-forensic-agent/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/votre-username/github-actions-forensic-agent/releases)

Un agent d'analyse forensique avancé pour GitHub Actions qui détecte les échecs masqués, les vulnérabilités de sécurité et les problèmes de configuration dans vos workflows CI/CD.

## 🎯 Fonctionnalités

- **🔍 Détection d'échecs masqués** : Identifie les jobs qui échouent silencieusement avec `continue-on-error`
- **🚨 Analyse de sécurité** : Détecte les secrets exposés, les commandes dangereuses et les permissions excessives
- **📊 Rapports détaillés** : Génère des rapports complets en Markdown et JSON
- **⚡ Analyse des performances** : Identifie les dégradations de performance et les timeouts
- **🎯 Annotations GitHub** : Crée automatiquement des annotations pour les problèmes critiques
- **📈 Score de risque** : Calcule un score de risque global pour votre infrastructure CI/CD

## 🚀 Installation et Utilisation

### Utilisation Basique

Ajoutez cette action à votre workflow GitHub :

```yaml
name: Analyse Forensique

on:
  schedule:
    - cron: '0 2 * * *' # Analyse quotidienne à 2h du matin
  workflow_dispatch: # Déclenchement manuel

jobs:
  forensic-analysis:
    runs-on: ubuntu-latest
    steps:
      - name: Analyse forensique des workflows
        uses: votre-username/github-actions-forensic-agent@v1
        with:
          repository: ${{ github.repository }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deep-scan: true
          output-format: 'both'
```

### Utilisation Avancée

```yaml
name: Analyse Forensique Avancée

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  security-audit:
    runs-on: ubuntu-latest
    steps:
      - name: Analyse forensique complète
        id: forensic
        uses: votre-username/github-actions-forensic-agent@v1
        with:
          repository: ${{ github.repository }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deep-scan: true
          max-runs: 100
          output-format: 'both'

      - name: Échec si problèmes critiques
        if: steps.forensic.outputs.critical-issues != '[]'
        run: |
          echo "🚨 Problèmes critiques détectés!"
          echo "${{ steps.forensic.outputs.critical-issues }}"
          exit 1

      - name: Upload du rapport
        uses: actions/upload-artifact@v4
        with:
          name: forensic-report
          path: ${{ steps.forensic.outputs.report-path }}

      - name: Notification Slack
        if: steps.forensic.outputs.hidden-failures > 0
        uses: 8398a7/action-slack@v3
        with:
          status: warning
          text: "🔍 ${{ steps.forensic.outputs.hidden-failures }} échecs cachés détectés dans les workflows"
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

## 📋 Paramètres

### Entrées (Inputs)

| Paramètre | Description | Requis | Défaut |
|-----------|-------------|---------|---------|
| `repository` | Dépôt à analyser (format: `owner/repo`) | ✅ | - |
| `github-token` | Token GitHub pour l'authentification API | ✅ | - |
| `deep-scan` | Active l'analyse approfondie des logs | ❌ | `false` |
| `max-runs` | Nombre maximum d'exécutions à analyser | ❌ | `50` |
| `output-format` | Format du rapport (`json`, `markdown`, `both`) | ❌ | `both` |

### Sorties (Outputs)

| Paramètre | Description |
|-----------|-------------|
| `hidden-failures` | Nombre d'échecs cachés détectés |
| `critical-issues` | Liste JSON des problèmes critiques |
| `report-path` | Chemin vers le fichier de rapport généré |
| `success` | Booléen indiquant si l'analyse a réussi |

## 🔍 Types de Problèmes Détectés

### 🚨 Problèmes Critiques
- **Secrets exposés** : Détection de mots de passe, tokens ou clés API dans les logs
- **Commandes dangereuses** : `curl | bash`, `wget | sh`, etc.
- **Permissions excessives** : `write-all` ou permissions trop larges

### ⚠️ Problèmes de Haute Sévérité
- **Échecs masqués** : Jobs qui échouent avec `continue-on-error: true`
- **Actions non versionnées** : Utilisation d'actions sans tag de version
- **Runners non sécurisés** : Utilisation de runners self-hosted non auditées

### ⚡ Problèmes de Sévérité Moyenne
- **Dégradation des performances** : Augmentation des temps d'exécution
- **Tests sautés** : Tests désactivés sans justification
- **Timeouts fréquents** : Jobs qui dépassent régulièrement les limites de temps

### 💡 Problèmes de Faible Sévérité
- **Warnings ignorés** : Messages d'avertissement non traités
- **Optimisations possibles** : Suggestions d'amélioration des performances

## 📊 Exemple de Rapport

```markdown
# 🔍 Rapport d'Analyse Forensique GitHub Actions

**Dépôt:** `mon-org/mon-projet`
**Date d'analyse:** 14/09/2025 10:30:25

## 📊 Résumé Exécutif

| Métrique | Valeur |
|----------|--------|
| 🔧 Workflows analysés | 12 |
| 🔍 Problèmes détectés | 8 |
| 👻 Échecs cachés | 2 |
| 🚨 Problèmes critiques | 1 |
| 📊 Score de risque | 45/100 |

### Interprétation du Score de Risque

⚡ **RISQUE MODÉRÉ** (45/100): Quelques améliorations sont recommandées pour optimiser la sécurité et la fiabilité.

## 🚨 Problèmes Critiques (Action Immédiate Requise)

### 🚨 EXPOSED_SECRET

**Message:** Secret potentiellement exposé dans les logs
**Workflow:** `deploy.yml`
**Recommandation:** Utiliser des secrets GitHub et éviter de logger des informations sensibles
```

## 🛠️ Développement

### Prérequis
- Node.js 20+
- npm ou yarn

### Installation
```bash
git clone https://github.com/votre-username/github-actions-forensic-agent.git
cd github-actions-forensic-agent
npm install
```

### Tests
```bash
# Tests unitaires
npm test

# Linting
npm run lint

# Formatage du code
npm run format
```

### Structure du Projet
```
github-actions-forensic-agent/
├── action.yml              # Définition de l'action
├── src/
│   ├── main.js             # Point d'entrée principal
│   ├── github-api.js       # Interface GitHub API
│   ├── analyzer.js         # Moteur d'analyse forensique
│   └── reporter.js         # Générateur de rapports
├── .github/workflows/
│   └── test.yml           # Tests automatisés
├── package.json
└── README.md
```

## 🔒 Sécurité

### Permissions Requises

Cette action nécessite les permissions GitHub suivantes :
- `actions: read` - Pour lire les workflows et exécutions
- `contents: read` - Pour accéder au contenu des fichiers de workflow
- `checks: write` - Pour créer des annotations (optionnel)

### Bonnes Pratiques

1. **Utilisez toujours un token avec des permissions minimales**
2. **Exécutez l'action sur des runners de confiance**
3. **Auditez régulièrement les rapports générés**
4. **Ne partagez jamais les rapports contenant des informations sensibles**

## 🤝 Contribution

Les contributions sont les bienvenues ! Voici comment contribuer :

1. **Fork** le projet
2. **Créez** une branche pour votre fonctionnalité (`git checkout -b feature/nouvelle-fonctionnalite`)
3. **Committez** vos changements (`git commit -am 'Ajout d'une nouvelle fonctionnalité'`)
4. **Poussez** vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. **Ouvrez** une Pull Request

### Guidelines de Contribution

- Suivez les conventions de code existantes
- Ajoutez des tests pour les nouvelles fonctionnalités
- Mettez à jour la documentation si nécessaire
- Assurez-vous que tous les tests passent

## 🐛 Dépannage

### Problèmes Courants

#### Erreur d'authentification
```
Error: Bad credentials
```
**Solution :** Vérifiez que votre `GITHUB_TOKEN` est valide et a les permissions nécessaires.

#### Timeout lors de l'analyse
```
Error: Request timeout
```
**Solution :** Réduisez le paramètre `max-runs` ou désactivez `deep-scan` pour les gros dépôts.

#### Rapport non généré
```
Error: Cannot write file
```
**Solution :** Vérifiez les permissions d'écriture dans le répertoire de travail.

### Support

- 📖 [Documentation complète](https://github.com/votre-username/github-actions-forensic-agent/wiki)
- 🐛 [Signaler un bug](https://github.com/votre-username/github-actions-forensic-agent/issues)
- 💬 [Discussions](https://github.com/votre-username/github-actions-forensic-agent/discussions)

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- L'équipe GitHub Actions pour l'excellente API
- La communauté open source pour les outils et bibliothèques utilisés
- Tous les contributeurs qui ont aidé à améliorer cet outil

---

**Développé avec ❤️ par [Manus AI](https://github.com/manus-ai)**

*Pour plus d'outils de sécurité et d'analyse CI/CD, visitez notre [organisation GitHub](https://github.com/manus-ai).*

