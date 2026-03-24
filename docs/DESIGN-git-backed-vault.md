# Design: Git-Backed Vault

## Architecture Decision

**The vault directory is a git repository with automatic version control for all CRM changes.**

This means:
- Every CRM change is versioned
- Full audit trail of all data modifications
- Automatic backup to remote repository
- Can revert changes, see history, blame lines
- Multiple users can collaborate (with merge conflict resolution)

## Git Workflow

After every entity creation or modification:

```bash
# System does automatically:
1. Create/update the markdown file
2. git add <file>
3. git commit -m "Create account: Acme Corp"
4. git push origin main
```

### Commit Message Format

```
Create <entity-type>: <name>
Update <entity-type>: <name>
Delete <entity-type>: <name>
```

## CLI Flags

```bash
# Normal: create, commit, and push
zcrm new account "Acme"

# Create and commit, but don't push yet
zcrm new account "Acme" --no-push

# Create file only, no git operations
zcrm new account "Acme" --no-commit
```

## Benefits

### Audit Trail
```bash
cd vault
git log --oneline
# cda4f3a Create opportunity: Q1 2025 Deal
# b2e8c91 Update contact: Jane Doe
# a1d7e90 Create account: Acme Corporation
```

### Revert Mistakes
```bash
git revert cda4f3a  # Undo that opportunity
```

### Collaboration
```bash
# User A creates account (auto-pushes)
zcrm new account "Acme"

# User B pulls changes and creates contact
cd vault && git pull
zcrm new contact --account acme "Jane Doe"
```

### Blame & History
```bash
git log vault/accounts/acme-corporation.md
git blame vault/accounts/acme-corporation.md
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No remote configured | Warn user, commit locally only |
| Network failure | Commit succeeds, push fails — warn user |
| Merge conflicts | Error with instructions to pull first |
| Validation hook failure | Commit blocked, file created but not committed |
| Nothing to commit | Silent success |

## Vault Repository Setup

### New vault:
```bash
cd vault
git init
git add .
git commit -m "Initial CRM vault structure"
git remote add origin git@github.com:yourorg/crm-vault.git
git push -u origin main
```

### As git submodule:
```bash
git submodule add git@github.com:yourorg/crm-vault.git vault
```

## Security Considerations

- Vault contains customer data — use a **private** git repository
- Never commit `.env` files with secrets
- Limit push access to vault repository
- Consider branch protection rules for main branch
