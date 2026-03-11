import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';

const PRO_FEATURES = [
  { icon: '[微]', label: '微信输入', description: '通过微信直接发送笔记' },
  { icon: '[回]', label: '每日回顾', description: '每日自动推送笔记回顾' },
  { icon: '[AI]', label: 'AI 洞察', description: '智能分析你的笔记模式' },
  { icon: '[漫]', label: '随机漫步', description: '随机发现你的历史笔记' },
];

export function ProUpgradeModal({ visible, onClose, onBuyPress, featureName, testID }) {
  const router = useRouter();

  function handleBuyPress() {
    onClose();
    if (onBuyPress) {
      onBuyPress();
    } else {
      router.push('/(app)/pro-purchase');
    }
  }

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID ?? 'pro-upgrade-modal'}
    >
      <Pressable
        style={styles.overlay}
        onPress={onClose}
        testID={testID ? `${testID}-overlay` : 'pro-upgrade-modal-overlay'}
      >
        <Pressable
          style={styles.sheet}
          onPress={() => {}}
          testID={testID ? `${testID}-sheet` : 'pro-upgrade-modal-sheet'}
        >
          <View style={styles.handle} />

          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>PRO</Text>
            </View>
          </View>

          <Text
            style={styles.title}
            testID={testID ? `${testID}-title` : 'pro-upgrade-modal-title'}
          >
            {featureName ? `「${featureName}」是 Pro 专属功能` : '升级 Pro 会员'}
          </Text>

          <Text
            style={styles.subtitle}
            testID={testID ? `${testID}-subtitle` : 'pro-upgrade-modal-subtitle'}
          >
            解锁全部高级功能，让记录更高效
          </Text>

          <View
            style={styles.featureList}
            testID={testID ? `${testID}-features` : 'pro-upgrade-modal-features'}
          >
            {PRO_FEATURES.map((feature) => (
              <View key={feature.label} style={styles.featureItem}>
                <View style={styles.featureIconBox}>
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                </View>
                <View style={styles.featureInfo}>
                  <Text style={styles.featureLabel}>{feature.label}</Text>
                  <Text style={styles.featureDesc}>{feature.description}</Text>
                </View>
                <View style={styles.featureCheck}>
                  <Text style={styles.featureCheckText}>v</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            style={styles.buyBtn}
            onPress={handleBuyPress}
            testID={testID ? `${testID}-buy-btn` : 'pro-upgrade-modal-buy-btn'}
            accessibilityRole="button"
            accessibilityLabel="立即购买 Pro 会员"
          >
            <Text style={styles.buyBtnText}>立即购买</Text>
          </Pressable>

          <Pressable
            style={styles.cancelBtn}
            onPress={onClose}
            testID={testID ? `${testID}-cancel-btn` : 'pro-upgrade-modal-cancel-btn'}
            accessibilityRole="button"
            accessibilityLabel="暂不购买"
          >
            <Text style={styles.cancelBtnText}>暂不购买</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
    }),
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  badgeRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  badge: {
    backgroundColor: '#f5a623',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  featureList: {
    marginBottom: 24,
    gap: 14,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fff8ec',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureIcon: {
    fontSize: 14,
    color: '#f5a623',
    fontWeight: '600',
  },
  featureInfo: {
    flex: 1,
  },
  featureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    lineHeight: 20,
  },
  featureDesc: {
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
  },
  featureCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4caf50',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureCheckText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  buyBtn: {
    backgroundColor: '#f5a623',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  buyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
  },
});
