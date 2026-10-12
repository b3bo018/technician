export type InstallationStatusLabel = 'Installed' | 'Uninstalled';

export function installationStatusLabel(value: unknown): InstallationStatusLabel | '' {
  const status = String(value ?? '').trim().toLowerCase().replace(/[ _-]+/g, ' ');
  if (status === 'installed') return 'Installed';
  if (['uninstalled', 'not installed', 'unistalled'].includes(status)) return 'Uninstalled';
  return '';
}
