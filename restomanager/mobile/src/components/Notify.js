// =============================================================================
//  Notify — wrapper quanh react-native-toast-message + ConfirmDialog
//  Mục tiêu: thay thế Alert.alert (UX kém) bằng:
//   - Toast cho thông báo 1 chiều (success / info / error)
//   - ConfirmDialog cho thao tác cần xác nhận (Yes/No)
//
//  Cách dùng:
//    import { toast, confirm } from '../components/Notify';
//    toast.ok('Đã lưu');
//    toast.err('Mất kết nối');
//    const ok = await confirm({ title:'Xoá?', message:'Không thể hoàn tác' });
// =============================================================================
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

// ─── Toast API (đơn giản hoá lib) ──────────────────────────────────────────
export const toast = {
  ok:   (text1, text2) => Toast.show({ type: 'success', text1, text2 }),
  info: (text1, text2) => Toast.show({ type: 'info',    text1, text2 }),
  err:  (text1, text2) => Toast.show({ type: 'error',   text1, text2 }),
  hide: () => Toast.hide(),
};

// ─── Cấu hình giao diện toast ───────────────────────────────────────────────
const _toastBase = {
  contentContainerStyle: { paddingHorizontal: 14 },
  text1Style: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  text2Style: { fontSize: 12, color: colors.muted },
};

export const toastConfig = {
  success: (props) => (
    <BaseToast
      {..._toastBase}
      {...props}
      style={{ borderLeftColor: '#16a34a', backgroundColor: '#fff', borderRadius: 12,
               shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}
    />
  ),
  info: (props) => (
    <BaseToast
      {..._toastBase}
      {...props}
      style={{ borderLeftColor: '#2563eb', backgroundColor: '#fff', borderRadius: 12,
               shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}
    />
  ),
  error: (props) => (
    <ErrorToast
      {..._toastBase}
      {...props}
      style={{ borderLeftColor: '#dc2626', backgroundColor: '#fff', borderRadius: 12,
               shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}
    />
  ),
};

// ─── ToastHost: đặt 1 lần ở root để các toast có chỗ render ──────────────
export function ToastHost() {
  const insets = useSafeAreaInsets();
  return (
    <Toast
      config={toastConfig}
      topOffset={insets.top + 8}
      bottomOffset={insets.bottom + 16}
      visibilityTime={2400}
    />
  );
}

// ─── Confirm Dialog (Promise-based) ────────────────────────────────────────
// Không dùng Alert.alert nữa. Thay bằng modal đẹp, có animation.
const ConfirmCtx = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({
    visible: false, title: '', message: '',
    okText: 'Đồng ý', cancelText: 'Huỷ',
    danger: false, _resolve: null,
  });
  const slide = useRef(new Animated.Value(0)).current;

  const show = useCallback((opts) => {
    return new Promise((resolve) => {
      setState({
        visible: true,
        title: opts.title || 'Xác nhận',
        message: opts.message || '',
        okText: opts.okText || 'Đồng ý',
        cancelText: opts.cancelText || 'Huỷ',
        danger: !!opts.danger,
        _resolve: resolve,
      });
      slide.setValue(0);
      Animated.timing(slide, {
        toValue: 1, duration: 180,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    });
  }, [slide]);

  const close = useCallback((result) => {
    setState((s) => {
      if (s._resolve) s._resolve(result);
      return { ...s, visible: false, _resolve: null };
    });
  }, []);

  const transY = slide.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const opacity = slide;

  return (
    <ConfirmCtx.Provider value={show}>
      {children}
      <Modal
        visible={state.visible}
        transparent
        animationType="fade"
        onRequestClose={() => close(false)}
      >
        <Pressable style={s.backdrop} onPress={() => close(false)}>
          <Animated.View
            style={[s.dialog, { opacity, transform: [{ translateY: transY }] }]}
            // Stop press propagation
            onStartShouldSetResponder={() => true}
          >
            <View style={s.iconWrap}>
              <Ionicons
                name={state.danger ? 'alert-circle' : 'help-circle'}
                size={36}
                color={state.danger ? '#dc2626' : colors.primary}
              />
            </View>
            <Text style={s.title}>{state.title}</Text>
            {!!state.message && <Text style={s.message}>{state.message}</Text>}

            <View style={s.actions}>
              <Pressable
                onPress={() => close(false)}
                style={({ pressed }) => [s.btn, s.btnGhost, pressed && s.btnPressed]}
              >
                <Text style={s.btnGhostText}>{state.cancelText}</Text>
              </Pressable>
              <Pressable
                onPress={() => close(true)}
                style={({ pressed }) => [
                  s.btn,
                  state.danger ? s.btnDanger : s.btnPrimary,
                  pressed && s.btnPressed,
                ]}
              >
                <Text style={s.btnPrimaryText}>{state.okText}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

// Hook + helper
export function useConfirm() {
  const fn = useContext(ConfirmCtx);
  if (!fn) throw new Error('useConfirm must be used inside ConfirmProvider');
  return fn;
}

// Bridge global: cho phép gọi `confirm({...})` ở bất cứ đâu, kể cả ngoài component
let _bridgeConfirm = null;
export function ConfirmBridge() {
  _bridgeConfirm = useConfirm();
  return null;
}
export function confirm(opts) {
  if (!_bridgeConfirm) {
    console.warn('confirm() gọi trước khi ConfirmProvider mount; trả về true mặc định.');
    return Promise.resolve(true);
  }
  return _bridgeConfirm(opts);
}

// ─── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%', maxWidth: 380,
    backgroundColor: '#fff', borderRadius: 20,
    paddingTop: 24, paddingHorizontal: 20, paddingBottom: 16,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  title:   { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center' },
  message: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20, alignSelf: 'stretch' },
  btn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  btnGhost:    { backgroundColor: '#f3f4f6' },
  btnGhostText:{ fontSize: 14, fontWeight: '700', color: colors.onSurface },
  btnPrimary:  { backgroundColor: colors.primary },
  btnDanger:   { backgroundColor: '#dc2626' },
  btnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  btnPressed:  { opacity: 0.85 },
});
