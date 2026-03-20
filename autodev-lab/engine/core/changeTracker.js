const fs = require('fs');
const path = require('path');

class ChangeTracker {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.changes = [];
    this.omitted = [];
    this.analyzedFiles = [];
  }

  toRelative(filePath) {
    return path.relative(this.config.repoRoot, filePath).split(path.sep).join('/');
  }

  recordAnalyzedFile(filePath) {
    const relativePath = this.toRelative(filePath);

    if (!this.analyzedFiles.includes(relativePath)) {
      this.analyzedFiles.push(relativePath);
    }
  }

  backupPathFor(filePath) {
    return `${filePath}.autodev.bak`;
  }

  ensureBackup(filePath) {
    const existingChange = this.changes.find((change) => change.filePath === filePath);
    if (existingChange) {
      return {
        existed: existingChange.existed,
        originalContent: existingChange.originalContent,
        backupPath: existingChange.backupPath,
      };
    }

    const backupPath = this.backupPathFor(filePath);
    const existed = fs.existsSync(filePath);
    const originalContent = existed ? fs.readFileSync(filePath, 'utf8') : '';
    const backupContent = existed ? originalContent : '__AUTODEV_NEW_FILE__';

    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.writeFileSync(backupPath, backupContent, 'utf8');

    return {
      existed,
      originalContent,
      backupPath,
    };
  }

  writeFile(filePath, nextContent, meta = {}) {
    const { existed, originalContent, backupPath } = this.ensureBackup(filePath);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, nextContent, 'utf8');

    const change = {
      filePath,
      relativePath: this.toRelative(filePath),
      backupPath,
      relativeBackupPath: this.toRelative(backupPath),
      existed,
      changed: originalContent !== nextContent,
      originalContent,
      nextContent,
      meta,
    };

    this.changes.push(change);

    this.logger.info('ChangeTracker: archivo registrado.', {
      archivo: change.relativePath,
      backup: change.relativeBackupPath,
      creado: !existed,
    });

    return change;
  }

  recordOmitted(entry) {
    this.omitted.push(entry);
    this.logger.warn('ChangeTracker: archivo omitido por seguridad.', entry);
  }

  restoreAll() {
    for (const change of [...this.changes].reverse()) {
      const absoluteFilePath = change.filePath;
      const absoluteBackupPath = change.backupPath;

      if (!fs.existsSync(absoluteBackupPath)) {
        continue;
      }

      const backupContent = fs.readFileSync(absoluteBackupPath, 'utf8');

      if (backupContent === '__AUTODEV_NEW_FILE__') {
        if (fs.existsSync(absoluteFilePath)) {
          fs.unlinkSync(absoluteFilePath);
        }
      } else {
        fs.writeFileSync(absoluteFilePath, backupContent, 'utf8');
      }

      this.logger.warn('ChangeTracker: restaurado desde backup.', {
        archivo: change.relativePath,
        backup: change.relativeBackupPath,
      });
    }
  }

  getProductiveChanges() {
    return this.changes.filter(
      (change) =>
        change.relativePath.startsWith('apps/mobile/') ||
        change.relativePath.startsWith('straight-wire-backend/')
    );
  }

  getBackendChanges() {
    return this.changes.filter((change) =>
      change.relativePath.startsWith('straight-wire-backend/')
    );
  }

  getSummary() {
    return {
      analyzedFiles: [...this.analyzedFiles].sort(),
      changes: [...this.changes],
      omitted: [...this.omitted],
      productiveFilesTouched: this.getProductiveChanges().length,
      backendFilesTouched: this.getBackendChanges().length,
      backups: this.changes.map((change) => change.relativeBackupPath),
      modifiedFiles: this.changes.map((change) => change.relativePath),
    };
  }
}

module.exports = {
  ChangeTracker,
};
