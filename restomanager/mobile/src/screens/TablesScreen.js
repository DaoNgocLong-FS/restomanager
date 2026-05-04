// Hiển thị sơ đồ bàn — dùng chung cho cả waiter và cashier.
// Khi tap 1 bàn:
//   - waiter  → mở MenuScreen (gọi món hoặc thêm món vào đơn mở)
//   - cashier → mở DetailScreen (xem chi tiết / sửa / thanh toán)
// Khi long-press 1 bàn (~700ms):
//   - admin/cashier → mở TableActionSheet (chuyển bàn / dọn bàn / tắt bàn)
//   - waiter        → bỏ qua (không có quyền)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Api } from '../api';
import { useAuth } from '../AuthContext';
import { useRealtime } from '../socket';
import { colors, fmt } from '../theme';
import TableActionSheet from '../components/TableActionSheet';

export default function TablesScreen({ navigation }) {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [zone, setZone] = useState('all');
  const [sheetTable, setSheetTable] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await Api.listTables({ with_status: 'true' });
      setTables(list);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: bàn / đơn / hoá đơn thay đổi → tự reload (debounce nhẹ)
  const reloadRef = useRef(null);
  const scheduleReload = useCallback(() => {
    if (reloadRef.current) clearTimeout(reloadRef.current);
    reloadRef.current = setTimeout(() => { load(); }, 120);
  }, [load]);
  useRealtime({
    'tables:changed':   scheduleReload,
    'orders:changed':   scheduleReload,
    'order:created':    scheduleReload,
    'order:updated':    scheduleReload,
    'order:cancelled':  scheduleReload,
    'order:moved':      scheduleReload,
    'invoice:created':  scheduleReload,
  });
  useEffect(() => () => { if (reloadRef.current) clearTimeout(reloadRef.current); }, []);

  const filtered = zone === 'all' ? tables : tables.filter(t => t.zone === zone);
  const zones = Array.from(new Set(tables.map(t => t.zone)));

  const onPress = (t) => {
    const inactive = t.status === 'inactive' || t.is_active === false;
    if (inactive) return; // bàn tắt: không cho mở chi tiết, chỉ long-press để bật lại
    if (user?.role === 'waiter') {
      if (t.status === 'pay') return;
      navigation.navigate('Menu', { table: t });
    } else {
      navigation.navigate('Detail', { table: t });
    }
  };

  // Mở action sheet khi long-press (chỉ cho admin/cashier).
  const onLongPress = (t) => {
    if (!['admin', 'cashier'].includes(user?.role)) return;
    setSheetTable(t);
  };

  const renderItem = ({ item: t }) => {
    const inactive = t.status === 'inactive' || t.is_active === false;
    const badge = inactive
      ? { bg: colors.badgeFree, fg: colors.badgeFreeText, lbl: 'Tạm khoá' }
      : t.status === 'busy' ? { bg: colors.badgeBusy, fg: colors.badgeBusyText, lbl: 'Có khách' }
      : t.status === 'pay'  ? { bg: colors.badgePay,  fg: colors.badgePayText,  lbl: 'Chờ TT' }
      :                       { bg: colors.badgeFree, fg: colors.badgeFreeText, lbl: 'Trống' };
    return (
      <Pressable
        style={[s.card, inactive && { opacity: 0.55 }]}
        onPress={() => onPress(t)}
        onLongPress={() => onLongPress(t)}
        delayLongPress={700}
        android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
      >
        <View style={s.cardTop}>
          <Text style={s.code}>{t.code}</Text>
          <View style={[s.badge, { backgroundColor: badge.bg }]}>
            <Text style={[s.badgeTxt, { color: badge.fg }]}>{badge.lbl}</Text>
          </View>
        </View>
        <View style={s.row}>
          <Ionicons name="people-outline" size={14} color={colors.muted} />
          <Text style={s.meta}>{t.capacity} chỗ</Text>
          <Text style={[s.meta, { marginLeft: 8 }]}>{t.zone}</Text>
        </View>
        {!inactive && t.status !== 'empty' && (
          <View style={s.row}>
            <Ionicons name="time-outline" size={14} color={colors.muted} />
            <Text style={s.meta}>{t.mins || 0} phút</Text>
            <Text style={[s.spent]}>{fmt(t.spent || 0)}</Text>
          </View>
        )}
        {inactive && (
          <View style={s.row}>
            <Ionicons name="lock-closed-outline" size={14} color={colors.muted} />
            <Text style={s.meta}>Tạm khoá</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.title}>{user?.role === 'waiter' ? 'Bàn của tôi' : 'Sơ đồ bàn'}</Text>
        <Text style={s.subtitle}>{user?.full_name || user?.username}</Text>
        {['admin', 'cashier'].includes(user?.role) && (
          <Text style={s.hint}>
            <Ionicons name="information-circle-outline" size={11} color={colors.muted} />
            {'  '}Nhấn giữ vào bàn để chuyển/dọn/tắt bàn
          </Text>
        )}
      </View>
      <View style={s.chips}>
        <Chip label="Tất cả" on={zone === 'all'} onPress={() => setZone('all')} />
        {zones.map(z => <Chip key={z} label={z} on={zone === z} onPress={() => setZone(z)} />)}
      </View>
      {loading && tables.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[colors.primary]} />}
          ListEmptyComponent={<Text style={s.empty}>Chưa có bàn.</Text>}
        />
      )}

      <TableActionSheet
        visible={!!sheetTable}
        table={sheetTable}
        role={user?.role}
        onClose={() => setSheetTable(null)}
        onChanged={load}
      />
    </View>
  );
}

function Chip({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress}
      style={[c.chip, on ? c.chipOn : c.chipOff]}>
      <Text style={[c.chipTxt, on && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const c = StyleSheet.create({
  chip:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  chipOn:  { backgroundColor: colors.primary, borderColor: colors.primary },
  chipOff: { backgroundColor: '#fff',         borderColor: colors.border },
  chipTxt: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
});

const s = StyleSheet.create({
  wrap:     { flex: 1, backgroundColor: colors.surface },
  header:   { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title:    { fontSize: 22, fontWeight: '700', color: colors.onSurface },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  hint:     { fontSize: 11, color: colors.muted, marginTop: 6 },
  chips:    { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8, flexWrap: 'wrap' },
  card:     { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.borderSoft },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  code:     { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  badge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  badgeTxt: { fontSize: 10, fontWeight: '700' },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  meta:     { fontSize: 11, color: colors.muted },
  spent:    { marginLeft: 'auto', fontSize: 12, fontWeight: '700', color: colors.primary },
  empty:    { textAlign: 'center', color: colors.muted, marginTop: 40 },
});
