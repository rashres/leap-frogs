# Git Commit Guide - How to Commit Code Changes

## What You Just Did ✅

You successfully committed two major features to the `feature/TradeServices` branch:

1. **OrderValidator.java** - Validation utility class (Commit: `93d1cf7`)
2. **Order.java** - Order domain model (Commit: `063f785`)

Both are now on GitHub!

---

## The Complete Git Workflow (5 Easy Steps)

### Step 1: Check Status
```bash
git status
```
**What it does**: Shows which files changed, which are staged, and which are untracked.

**Output example**:
```
Changes not staged for commit:
  modified:   pom.xml
Untracked files:
  new file:   src/main/java/com/neueda/leap/OrderValidator.java
```

---

### Step 2: Stage Your Files
```bash
# Stage a single file
git add src/main/java/com/neueda/leap/OrderValidator.java

# Stage multiple files
git add src/main/java/com/neueda/leap/OrderValidator.java src/test/java/com/neueda/leap/OrderValidatorTest.java pom.xml

# Stage all changes
git add .
```

**What it does**: Tells git "I want to include these files in my next commit."

**Think of it as**: Putting files in a box before shipping them.

---

### Step 3: Commit Your Changes
```bash
git commit -m "Your commit message here"
```

**Good commit message format**:
```bash
git commit -m "feat: Add OrderValidator utility class for validation

- Implement static validation methods
- Add ValidationResult inner class
- Add 30 comprehensive unit tests
- Update pom.xml with JUnit dependency"
```

**What it does**: Creates a snapshot of your changes with a description.

**Commit message tips**:
- Start with `feat:` (new feature), `fix:` (bug fix), `docs:` (documentation), `test:` (tests)
- Keep it short and descriptive
- Use bullet points for details
- Include test results if applicable

---

### Step 4: Pull Latest Remote Changes
```bash
git pull origin feature/TradeServices --no-edit
```

**What it does**: Downloads any changes others made to the same branch.

**Why**: Prevents conflicts when pushing.

---

### Step 5: Push to Remote (GitHub)
```bash
git push origin feature/TradeServices
```

**What it does**: Uploads your commits to GitHub.

**Output example**:
```
To https://github.com/rashres/leap-frogs.git
   5370077..4613bb7  feature/TradeServices -> feature/TradeServices
```

---

## Quick Reference - Commands You'll Use Most

```bash
# Check what changed
git status

# Stage files
git add <filename>          # Single file
git add .                   # All changes

# View staged changes
git diff --staged

# Commit changes
git commit -m "Your message"

# View commit history
git log --oneline           # Short format
git log --oneline -5        # Last 5 commits

# Push to GitHub
git push origin <branch-name>

# Pull latest changes
git pull origin <branch-name>
```

---

## Your Commits on This Project

| Commit | Description | Files |
|--------|-------------|-------|
| `93d1cf7` | Add OrderValidator utility class | OrderValidator.java, OrderValidatorTest.java, pom.xml |
| `063f785` | Add Order domain model | Order.java, OrderTest.java, docs |

**View them on GitHub**: https://github.com/rashres/leap-frogs/commits/feature/TradeServices

---

## Common Scenarios

### I made a mistake in my commit message
```bash
git commit --amend -m "New message"
```

### I want to undo my last commit (keep changes)
```bash
git reset --soft HEAD~1
```

### I want to see what's in a commit
```bash
git show 93d1cf7
```

### I want to go back to a previous commit
```bash
git log --oneline
git checkout <commit-hash>
```

---

## Tips for Clean Commits

✅ **DO**:
- Commit related changes together
- Write clear, descriptive messages
- Test your code before committing
- Pull before pushing
- Include the number of tests passing

❌ **DON'T**:
- Commit code that doesn't compile
- Mix unrelated changes in one commit
- Use vague messages like "fix stuff" or "updates"
- Commit large binary files
- Forget to pull before pushing

---

## Your Current Branch
```
Branch: feature/TradeServices
Remote: https://github.com/rashres/leap-frogs.git
```

All your validation classes are safe on GitHub! 🎉

---

## Need Help?

```bash
# Get help for any git command
git help <command>

# Examples:
git help add
git help commit
git help push
```

Now you know how to commit! Use this workflow every time you complete a feature. 🚀
