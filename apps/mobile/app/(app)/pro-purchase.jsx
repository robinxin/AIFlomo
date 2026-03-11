import { View, Text, Pressable, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { useRouter } from 'expo-router';

export default function ProPurchaseScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} testID="pro-purchase-screen">
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="返回"
          testID="pro-purchase-back-btn"
        >
          <Text style={styles.backBtnText}>{'< 返回'}</Text>
        </Pressable>
        <Text style={styles.pageTitle} testID="pro-purchase-title">Pro 会员</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      <View style={styles.container} testID="pro-purchase-content">
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PRO</Text>
        </View>

        <Text style={styles.title} testID="pro-purchase-heading">Pro 会员购买</Text>

        <Text style={styles.subtitle} testID="pro-purchase-subtitle">
          该功能即将上线，敬请期待
        </Text>

        <Text style={styles.description} testID="pro-purchase-description">
          Pro 会员将解锁微信输入、每日回顾、AI 洞察、随机漫步等高级功能。
          购买页面正在建设中，请稍后再试。
        </Text>

        <Pressable
          style={styles.backToMemoBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="返回笔记页"
          testID="pro-purchase-back-to-memo-btn"
        >
          <Text style={styles.backToMemoBtnText}>返回笔记页</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2f3f5',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e8e8',
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    minWidth: 64,
  },
  backBtnText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  backBtnPlaceholder: {
    minWidth: 64,
  },
  pageTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  badge: {
    backgroundColor: '#f5a623',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 24,
  },
  badgeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 15,
    color: '#f5a623',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  description: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  backToMemoBtn: {
    backgroundColor: '#4caf50',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToMemoBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
});
