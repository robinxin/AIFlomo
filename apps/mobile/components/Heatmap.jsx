import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useMemoContext } from '@/context/MemoContext';

const DAYS = 90;
const CELL_SIZE = 12;
const CELL_GAP = 2;
const WEEK_DAYS = 7;

function getColorForCount(count) {
  if (count === 0) return '#ebedf0';
  if (count <= 2) return '#c6e48b';
  if (count <= 5) return '#7bc96f';
  if (count <= 9) return '#239a3b';
  return '#196127';
}

function buildGrid(heatmapData) {
  const countMap = {};
  for (const item of heatmapData) {
    countMap[item.day] = item.count;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    const dayStr = `${year}-${month}-${date}`;
    cells.push({ day: dayStr, count: countMap[dayStr] ?? 0 });
  }

  const firstDayOfWeek = new Date(today);
  firstDayOfWeek.setDate(firstDayOfWeek.getDate() - (DAYS - 1));
  const startDayOfWeek = firstDayOfWeek.getDay();

  const paddedCells = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    paddedCells.push(null);
  }
  for (const cell of cells) {
    paddedCells.push(cell);
  }

  const columns = [];
  const totalSlots = paddedCells.length;
  const numCols = Math.ceil(totalSlots / WEEK_DAYS);
  for (let col = 0; col < numCols; col++) {
    const column = [];
    for (let row = 0; row < WEEK_DAYS; row++) {
      const idx = col * WEEK_DAYS + row;
      column.push(idx < totalSlots ? paddedCells[idx] : null);
    }
    columns.push(column);
  }

  return columns;
}

export function Heatmap() {
  const { state } = useMemoContext();
  const heatmapData = state.heatmapData ?? [];

  const columns = useMemo(() => buildGrid(heatmapData), [heatmapData]);

  const totalCount = useMemo(
    () => heatmapData.reduce((sum, item) => sum + (item.count ?? 0), 0),
    [heatmapData]
  );

  return (
    <View style={styles.container} testID="heatmap">
      <View style={styles.header}>
        <Text style={styles.title}>最近 90 天</Text>
        <Text style={styles.subtitle} testID="heatmap-total-count">
          共 {totalCount} 条笔记
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        testID="heatmap-scroll"
      >
        <View style={styles.grid} testID="heatmap-grid">
          {columns.map((column, colIdx) => (
            <View key={colIdx} style={styles.column}>
              {column.map((cell, rowIdx) => {
                if (cell === null) {
                  return (
                    <View
                      key={rowIdx}
                      style={[styles.cell, styles.cellEmpty]}
                    />
                  );
                }
                return (
                  <View
                    key={rowIdx}
                    style={[
                      styles.cell,
                      { backgroundColor: getColorForCount(cell.count) },
                    ]}
                    testID={`heatmap-cell-${cell.day}`}
                    accessibilityLabel={`${cell.day}: ${cell.count} 条笔记`}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.legend} testID="heatmap-legend">
        <Text style={styles.legendLabel}>少</Text>
        {[0, 2, 5, 9, 10].map((count) => (
          <View
            key={count}
            style={[styles.legendCell, { backgroundColor: getColorForCount(count) }]}
          />
        ))}
        <Text style={styles.legendLabel}>多</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  subtitle: {
    fontSize: 12,
    color: '#aaa',
  },
  scrollContent: {
    flexGrow: 1,
  },
  grid: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  column: {
    flexDirection: 'column',
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
  },
  cellEmpty: {
    backgroundColor: 'transparent',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 3,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 10,
    color: '#aaa',
    marginHorizontal: 2,
  },
});
