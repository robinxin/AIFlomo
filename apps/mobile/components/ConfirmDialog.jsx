import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  confirmDanger,
  onConfirm,
  onCancel,
  testID,
}) {
  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      testID={testID ?? 'confirm-dialog'}
    >
      <Pressable
        style={styles.overlay}
        onPress={onCancel}
        testID={testID ? `${testID}-overlay` : 'confirm-dialog-overlay'}
      >
        <Pressable
          style={styles.dialog}
          onPress={() => {}}
          testID={testID ? `${testID}-box` : 'confirm-dialog-box'}
        >
          {title ? (
            <Text
              style={styles.title}
              testID={testID ? `${testID}-title` : 'confirm-dialog-title'}
            >
              {title}
            </Text>
          ) : null}

          {message ? (
            <Text
              style={styles.message}
              testID={testID ? `${testID}-message` : 'confirm-dialog-message'}
            >
              {message}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnCancel]}
              onPress={onCancel}
              testID={testID ? `${testID}-cancel` : 'confirm-dialog-cancel'}
              accessibilityRole="button"
              accessibilityLabel={cancelText ?? '取消'}
            >
              <Text style={styles.btnCancelText}>{cancelText ?? '取消'}</Text>
            </Pressable>

            <Pressable
              style={[styles.btn, confirmDanger ? styles.btnDanger : styles.btnPrimary]}
              onPress={onConfirm}
              testID={testID ? `${testID}-confirm` : 'confirm-dialog-confirm'}
              accessibilityRole="button"
              accessibilityLabel={confirmText ?? '确认'}
            >
              <Text style={confirmDanger ? styles.btnDangerText : styles.btnPrimaryText}>
                {confirmText ?? '确认'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  dialog: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
    }),
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#222',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 24,
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    backgroundColor: '#f5f5f5',
  },
  btnPrimary: {
    backgroundColor: '#4caf50',
  },
  btnDanger: {
    backgroundColor: '#ffebee',
  },
  btnCancelText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  btnPrimaryText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  btnDangerText: {
    fontSize: 15,
    color: '#e53935',
    fontWeight: '600',
  },
});
