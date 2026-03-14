import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useState } from 'react';

const CELL_SIZE = 12;
const CELL_GAP = 2;
const DAYS = 90;

const COLOR_LEVELS = ['#e8f5e9', '#a5d6a7', '#66bb6a', '#388e3c', '#1b5e20'];

function getColor(count) {
  if (count === 0) return COLOR_LEVELS[0];
  if (count === 1) return COLOR_LEVELS[1];
  if (count === 2) return COLOR_LEVELS[2];
  if (count <= 4) return COLOR_LEVELS[3];
  return COLOR_LEVELS[4];
}

function buildDates() {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function HeatmapCalendar({ data }) {
  const [tooltip, setTooltip] = useState(null);

  const countMap = {};
  if (data) {
    for (const item of data) {
      countMap[item.date] = item.count;
    }
  }

  const dates = buildDates();

  // 以周为单位分组（每列7天）
  const weeks = [];
  let week = [];
  for (let i = 0; i < dates.length; i++) {
    week.push(dates[i]);
    if (week.length === 7 || i === dates.length - 1) {
      weeks.push(week);
      week = [];
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>过去 90 天</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.grid}>
          {weeks.map((w, wi) => (
            <View key={wi} style={styles.column}>
              {w.map((date) => {
                const count = countMap[date] ?? 0;
                return (
                  <TouchableOpacity
                    key={date}
                    onPress={() =>
                      setTooltip(tooltip === date ? null : date)
                    }
                    style={[
                      styles.cell,
                      { backgroundColor: getColor(count) },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      {!!tooltip && (
        <Text style={styles.tooltip}>
          {tooltip}：{countMap[tooltip] ?? 0} 条
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 8,
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
  tooltip: {
    marginTop: 6,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
