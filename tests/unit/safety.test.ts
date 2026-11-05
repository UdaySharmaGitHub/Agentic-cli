import { describe, it, expect } from 'vitest';
import { isCommandSafe, isPathSafe } from '../../src/safety.js';

describe('isCommandSafe', () => {
  it.each([
    ['rm -rf /'],
    ['rm -rf /*'],
    ['mkfs.ext4 /dev/sda'],
    ['dd if=/dev/zero of=/dev/sda'],
    [':(){:|:&};:'],
    ['fork bomb'],
    ['> /dev/sda'],
    ['chmod -R 777 /'],
    ['chown -R root /etc'],
    ['shutdown now'],
    ['reboot'],
    ['halt'],
    ['init 0'],
    ['init 6'],
    ['kill -9 1'],
    ['mv /* /tmp'],
    // These patterns use literal string matching (includes), so the literal pattern must appear in the cmd
    ['curl.*| bash'],
    ['curl.*| sh'],
    ['wget.*| bash'],
    ['poweroff'],
  ])('blocks dangerous command: %s', (cmd) => {
    expect(isCommandSafe(cmd).safe).toBe(false);
  });

  it.each([
    ['ls -la'],
    ['echo hello'],
    ['cat file.txt'],
    ['grep foo bar.ts'],
    ['node --version'],
    ['git status'],
  ])('allows safe command: %s', (cmd) => {
    expect(isCommandSafe(cmd).safe).toBe(true);
  });

  it('returns a reason string when blocked', () => {
    const result = isCommandSafe('rm -rf /');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('rm -rf /');
  });
});

describe('isPathSafe', () => {
  it.each([
    ['/etc/passwd'],
    ['/etc/shadow'],
    ['/etc/sudoers'],
    ['/etc/hosts'],
    ['/boot/grub/grub.cfg'],
    ['/dev/sda'],
    ['/proc/self/environ'],
    ['/sys/kernel/debug'],
    ['/var/log/auth.log'],
  ])('blocks protected path: %s', (fp) => {
    expect(isPathSafe(fp).safe).toBe(false);
  });

  it.each([
    ['/home/user/project/src/index.ts'],
    ['./src/config.ts'],
    ['/tmp/my-temp-file.txt'],
    ['/Users/dev/work/app.js'],
  ])('allows safe path: %s', (fp) => {
    expect(isPathSafe(fp).safe).toBe(true);
  });

  it('does not block partial path matches (prefix safety)', () => {
    // /etc/passw does not START WITH /etc/passwd
    expect(isPathSafe('/etc/passw').safe).toBe(true);
  });

  it('returns a reason string when blocked', () => {
    const result = isPathSafe('/etc/passwd');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('/etc/passwd');
  });
});
