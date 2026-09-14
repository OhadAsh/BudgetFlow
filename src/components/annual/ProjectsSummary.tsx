import { Badge, Card, Group, ScrollArea, Stack, Table, Text } from '@mantine/core';
import { COLORS, SECTION_TITLE_STYLE } from '../../lib/constants';
import { formatCurrency, formatDisplayDate } from '../../lib/utils';
import { useMonthData } from '../../hooks/useMonthData';

/**
 * Project cost meter for out-of-flow categories (wedding, apartment down payment).
 * These amounts are intentionally missing from every KPI, so this is the one place
 * that shows how much the project actually cost.
 */
export function ProjectsSummary(): JSX.Element | null {
  const { outOfFlowProjects, year } = useMonthData();

  if (outOfFlowProjects.length === 0) {
    return null;
  }

  const yearTotal = outOfFlowProjects.reduce((total, project) => total + project.yearTotal, 0);
  const allTimeTotal = outOfFlowProjects.reduce(
    (total, project) => total + project.allTimeTotal,
    0
  );

  return (
    <Card>
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="wrap" gap="xs">
          <Text style={SECTION_TITLE_STYLE}>🏰 פרויקטים והשקעות</Text>
          <Badge color="gray" variant="light" radius="sm">
            לא נספר בתזרים
          </Badge>
        </Group>

        <Text fz="xs" c={COLORS.textSecondary}>
          קטגוריות חוץ-תזרים — כסף שתוכנן מראש למטרה מסוימת. ההוצאות מתועדות במלואן אבל לא
          משפיעות על הממוצעים, על שיעור החיסכון ועל הגרפים.
        </Text>

        <ScrollArea type="auto" offsetScrollbars>
          <Table
            highlightOnHover
            verticalSpacing="xs"
            horizontalSpacing="sm"
            style={{ minWidth: 460 }}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>פרויקט</Table.Th>
                <Table.Th>{`ב-${year}`}</Table.Th>
                <Table.Th>מצטבר</Table.Th>
                <Table.Th>תשלומים</Table.Th>
                <Table.Th>תשלום אחרון</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {outOfFlowProjects.map((project) => (
                <Table.Tr key={project.category}>
                  <Table.Td>
                    <Badge
                      variant="light"
                      radius="sm"
                      styles={{
                        root: {
                          backgroundColor: `${project.color}1A`,
                          color: project.color,
                          textTransform: 'none',
                          fontWeight: 600,
                        },
                      }}
                    >
                      {`${project.emoji} ${project.category}`}
                    </Badge>
                  </Table.Td>
                  <Table.Td
                    style={{ direction: 'ltr', unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}
                  >
                    {formatCurrency(project.yearTotal)}
                  </Table.Td>
                  <Table.Td
                    style={{
                      direction: 'ltr',
                      unicodeBidi: 'isolate',
                      whiteSpace: 'nowrap',
                      fontWeight: 700,
                    }}
                  >
                    {formatCurrency(project.allTimeTotal)}
                  </Table.Td>
                  <Table.Td>{project.paymentCount}</Table.Td>
                  <Table.Td
                    style={{ direction: 'ltr', unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}
                  >
                    {formatDisplayDate(project.lastPaymentDate)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
            {outOfFlowProjects.length > 1 && (
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Th>{'סה"כ'}</Table.Th>
                  <Table.Th
                    style={{ direction: 'ltr', unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}
                  >
                    {formatCurrency(yearTotal)}
                  </Table.Th>
                  <Table.Th
                    style={{ direction: 'ltr', unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}
                  >
                    {formatCurrency(allTimeTotal)}
                  </Table.Th>
                  <Table.Th />
                  <Table.Th />
                </Table.Tr>
              </Table.Tfoot>
            )}
          </Table>
        </ScrollArea>
      </Stack>
    </Card>
  );
}
