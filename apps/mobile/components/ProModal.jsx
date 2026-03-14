import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';

export function ProModal({ visible, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>✨ 升级 Pro 会员</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.desc}>
            Pro 会员专享功能：{'\n'}
            • 微信快速输入{'\n'}
            • 每日回顾{'\n'}
            • AI 洞察{'\n'}
            • 随机漫步
          </Text>
          <View style={styles.footer}>
            <Text style={styles.comingSoon}>敬请期待</Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeText: {
    fontSize: 16,
    color: '#aaa',
  },
  desc: {
    fontSize: 15,
    color: '#555',
    lineHeight: 26,
    marginBottom: 20,
  },
  footer: {
    alignItems: 'center',
  },
  comingSoon: {
    fontSize: 13,
    color: '#aaa',
  },
});
