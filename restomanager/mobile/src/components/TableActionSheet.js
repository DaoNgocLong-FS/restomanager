// =============================================================================
//  TableActionSheet
//  - Modal bottom sheet hiển thị khi long-press 1 thẻ bàn
//  - Gồm các action: chuyển bàn, dọn bàn, bật/tắt bàn (tuỳ trạng thái + role)
//  - Disable phù hợp khi action không hợp lệ
// =============================================================================
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, FlatList,
  Animated, Easing, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Api } from '../api';
import { colors, fmt } from '../theme';

const ROLES_ALLOWED = new Set(['admin', 'cashier']);

/**
 * Props:
 *  - visible: boolean
 *  - table:   { id, code, status, is_active, open_order_id, ... }
 *  - role:    string ('admin' | 'cashier' | ...)
 *  - onClose: () => void
 *  - onChanged: () => void   // gọi khi có thay đổi để parent reload
 */
export default function TableActionSheet({ visible, table, role, onClose, onChanged }) {
  const [phase, setPhase] = useState('menu'); // 'menu' | 'move' | 'busy'
  const [tablesForMove, setTablesForMove] = useState([]);
  const [busy, setBusy] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;

  // Reset state khi mở
  useEffect(() => {
    if (visible) {
      setPhase('menu');
      setTablesForMove([]);
      setBusy(false);
      Animated.timing(slide, { toValue: 1, duration: 180, useNativeDriver: true, easing: Easing.out(Easing.cubic) }).start();
    } else {
      slide.setValue(0);
    }
  }, [visible, slide]);

  if (!visible || !table) return null;

  const allowed = ROLES_ALLOWED.has(role);
  const isActive = table.is_active !== false;
  const hasOpenOrder = !!table.open_order_id || table.status === 'busy' || table.status === 'pay';

  const close = () => { if (busy) return; onClose && onClose(); };
  const reload = () => { onChanged && onChanged(); };

  // ─── Action: chuyển bàn ────────────────────────────────────────────────
  const startMove = async () => {
    if (!hasOpenOrder) return Alert.alert('Bàn chưa có order', 'Không có gì để chuyển.');
    setBusy(true);
    try {
      const list = await Api.listTables({ with_status: 'true' });
      const candidates = list.filter(t =>
        t.id !== table.id && t.is_active !== false &&
        (t.status === 'empty' || !t.status)
      );
      if (candidates.length === 0) {
        setBusy(false);
        return Alert.alert('Hết bàn trống', 'Không có bàn nào trống để chuyển sang.');
      }
      setTablesForMove(candidates);
      setPhase('move');
    } catch (e) {
      Alert.alert('Lỗi', e.message || 'Không tải được danh sách bàn');
    } finally { setBusy(false); }
  };

  const doMove = async (toTable) => {
    setBusy(true);
    try {
      await Api.moveOrder(table.open_order_id, toTable.id);
      reload();
      onClose && onClose();
      Alert.alert('Đã chuyển', `Order đã chuyển sang bàn ${toTable.code}`);
    } catch (e) {
      Alert.alert('Lỗi chuyển bàn', e.message || 'Không thể chuyển bàn');
    } finally { setBusy(false); }
  };

  // ─── Action: dọn bàn ───────────────────────────────────────────────────
  const askClear = () => {
    if (!hasOpenOrder) return Alert.alert('Bàn đã trống', 'Không có gì để dọn.');
    Alert.alert(
      `Dọn bàn ${table.code}?`,
      'Order đang mở sẽ bị HUỶ (không tạo hoá đơn).\nDùng khi khách bỏ về hoặc cần reset bàn.',
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Dọn bàn', style: 'destructive', onPress: doClear },
      ]
    );
  };
  const doClear = async () => {
    setBusy(true);
    try {
      await Api.clearTable(table.id, 'Khách bỏ về');
      reload();
      onClose && onClose();
    } catch (e) {
      Alert.alert('Lỗi dọn bàn', e.message || 'Không thể dọn bàn');
    } finally { setBusy(false); }
  };

  // ─── Action: bật/tắt bàn ───────────────────────────────────────────────
  const askToggle = () => {
    if (isActive && hasOpenOrder) {
      return Alert.alert(
        'Không thể tắt',
        'Bàn đang có order mở. Vui lòng thanh toán hoặc dọn bàn trước.'
      );
    }
    Alert.alert(
      isActive ? `Tạm khoá bàn ${table.code}?` : `Kích hoạt lại bàn ${table.code}?`,
      isActive
        ? 'Khi tắt, không thể tạo order mới trên bàn này. Dùng khi bàn hỏng/đang sửa.'
        : 'Bàn sẽ sẵn sàng nhận order mới.',
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: isActive ? 'Tắt bàn' : 'Bật bàn', onPress: () => doToggle(!isActive) },
      ]
    );
  };
  const doToggle = async (makeActive) => {
    setBusy(true);
    try {
      await Api.setTableActive(table.id, makeActive);
      reload();
      onClose && onClose();
    } catch (e) {
      Alert.alert('Lỗi', e.message || 'Không thể cập nhật bàn');
    } finally { setBusy(false); }
  };

  // ─── Items ─────────────────────────────────────────────────────────────
  const items = [
    {
      key: 'move', icon: 'swap-horizontal', label: 'Chuyển bàn…',
      disabled: !hasOpenOrder, onPress: startMove,
    },
    {
      key: 'clear', icon: 'trash-outline', label: 'Dọn bàn (huỷ order)',
      danger: true, disabled: !hasOpenOrder, onPress: askClear,
    },
    { sep: true },
    isActive
      ? { key: 'disable', icon: 'pause-circle-outline', label: 'Tạm khoá bàn',
          disabled: hasOpenOrder, onPress: askToggle }
      : { key: 'enable',  icon: 'play-circle-outline',  label: 'Kích hoạt lại bàn',
          onPress: askToggle },
  ];

  const transY = slide.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close} />
      <Animated.View style={[s.sheet, { transform: [{ translateY: transY }] }]}>
        <View style={s.handle} />

        {phase === 'menu' && (
          <>
            <View style={s.header}>
              <Text style={s.title}>Bàn {table.code}</Text>
              <Text style={s.subtitle}>
                {!isActive ? 'Đang tạm khoá' :
                 table.status === 'busy' ? 'Có khách' :
                 table.status === 'pay'  ? 'Chờ thanh toán' :
                 'Đang trống'}
                {table.spent ? `  ·  ${fmt(table.spent)}` : ''}
              </Text>
            </View>

            {!allowed ? (
              <View style={s.notice}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
                <Text style={s.noticeText}>
                  Cần quyền cashier hoặc admin để thao tác trên bàn.
                </Text>
              </View>
            ) : (
              items.map((it, i) =>
                it.sep
                  ? <View key={'sep' + i} style={s.sep} />
                  : (
                    <Pressable
                      key={it.key}
                      onPress={it.disabled || busy ? undefined : it.onPress}
                      style={({ pressed }) => [
                        s.row,
                        pressed && !it.disabled && s.rowPressed,
                        it.disabled && s.rowDisabled,
                      ]}
                    >
                      <Ionicons
                        name={it.icon}
                        size={22}
                        color={it.danger ? '#b91c1c' : colors.onSurface}
                      />
                      <Text style={[s.rowLabel, it.danger && { color: '#b91c1c' }]}>
                        {it.label}
                      </Text>
                    </Pressable>
                  )
              )
            )}

            {busy && <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />}

            <Pressable onPress={close} style={s.cancelBtn} disabled={busy}>
              <Text style={s.cancelText}>Đóng</Text>
            </Pressable>
          </>
        )}

        {phase === 'move' && (
          <>
            <View style={s.header}>
              <Text style={s.title}>Chuyển sang bàn nào?</Text>
              <Text style={s.subtitle}>
                Từ bàn {table.code} · chỉ liệt kê bàn đang trống
              </Text>
            </View>
            <FlatList
              data={tablesForMove}
              keyExtractor={(t) => t.id}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={busy ? undefined : () => doMove(item)}
                  style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                >
                  <View style={s.tableIcon}>
                    <Ionicons name="restaurant-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>{item.code}</Text>
                    <Text style={s.rowMeta}>
                      {item.zone || ''} · {item.capacity || '?'} chỗ
                    </Text>
                  </View>
                  <Text style={s.tagFree}>Trống</Text>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={s.sep} />}
            />
            {busy && <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />}
            <Pressable
              onPress={() => setPhase('menu')}
              style={s.cancelBtn}
              disabled={busy}
            >
              <Text style={s.cancelText}>Quay lại</Text>
            </Pressable>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 8, paddingBottom: 24, paddingTop: 8,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 },
  },
  handle: {
    width: 40, height: 4, borderRadius: 4,
    backgroundColor: '#cbd5e1', alignSelf: 'center', marginVertical: 8,
  },
  header: { paddingHorizontal: 16, paddingVertical: 8, gap: 2 },
  title: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  subtitle: { fontSize: 12, color: colors.muted },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12,
  },
  rowPressed: { backgroundColor: '#f3f4f6' },
  rowDisabled: { opacity: 0.4 },
  rowLabel: { fontSize: 15, color: colors.onSurface, flex: 1, fontWeight: '500' },
  rowMeta:  { fontSize: 11, color: colors.muted, marginTop: 2 },

  sep: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 16, marginVertical: 4 },

  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f9fafb', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 12, marginTop: 6,
  },
  noticeText: { fontSize: 13, color: colors.muted, flex: 1 },

  cancelBtn: {
    marginTop: 12, marginHorizontal: 12,
    paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#f3f4f6', alignItems: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.onSurface },

  tableIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#eef2ff',
    alignItems: 'center', justifyContent: 'center',
  },
  tagFree: {
    fontSize: 11, fontWeight: '700',
    color: '#15803d', backgroundColor: '#dcfce7',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99,
  },
});
