/** Props for the panel of the selected tab. */
export const tabPanelProps = (id: string, value: string) => ({
  role: 'tabpanel' as const,
  id: `${id}-panel-${value}`,
  'aria-labelledby': `${id}-tab-${value}`,
  tabIndex: 0,
});
