'use client';

import { Activity, Building2, Cable, Settings2 } from 'lucide-react';
import { useUiTranslation } from '@/i18n/locale-context';
import { integrationSections, type IntegrationSection } from '../model';
import {
  integrationNavigation,
  integrationSectionHelp,
  navigationGroup,
} from '../navigation';
import styles from './integration-navigation.module.css';

const icons = {
  sites: Building2,
  connect: Cable,
  monitor: Activity,
  settings: Settings2,
};

export function IntegrationNavigation({
  section,
  disabled,
  onChange,
  allowedSections = integrationSections.map(({ id }) => id),
}: {
  section: IntegrationSection;
  disabled: boolean;
  onChange: (section: IntegrationSection) => void;
  allowedSections?: readonly IntegrationSection[];
}) {
  const t = useUiTranslation();
  const current = navigationGroup(section);
  return (
    <div className={styles.root}>
      <nav
        aria-label={t('مسیرهای اصلی یکپارچه‌سازی')}
        className={styles.groups}
      >
        {integrationNavigation.map((group) => {
          const sections = group.sections.filter((id) =>
            allowedSections.includes(id),
          );
          if (!sections.length) return null;
          const Icon = icons[group.id];
          const active = current.id === group.id;
          return (
            <button
              type="button"
              key={group.id}
              aria-current={active ? 'true' : undefined}
              aria-controls="integration-section-navigation"
              disabled={disabled}
              onClick={() => onChange(sections[0]!)}
              className={styles.group}
            >
              <Icon aria-hidden="true" className={styles.icon} />
              <span>
                <strong>{t(group.title)}</strong>
                <small>{t(group.hint)}</small>
              </span>
            </button>
          );
        })}
      </nav>
      <div id="integration-section-navigation" className={styles.context}>
        {current.sections.length > 1 ? (
          <nav
            aria-label={t('بخش‌های یکپارچه‌سازی')}
            className={styles.sections}
          >
            {current.sections
              .filter((id) => allowedSections.includes(id))
              .map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  aria-current={section === id ? 'page' : undefined}
                  className={styles.section}
                  onClick={() => onChange(id)}
                >
                  {t(integrationSections.find((item) => item.id === id)!.title)}
                </button>
              ))}
          </nav>
        ) : null}
        <p className={styles.help}>{t(integrationSectionHelp[section])}</p>
      </div>
    </div>
  );
}
