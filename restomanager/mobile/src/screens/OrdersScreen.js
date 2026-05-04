// Danh sách đơn:
// - Waiter: xem các đơn của mình
// - Cashier: xem tất cả đơn (paid + pending)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Api } from '../api';
import { useAuth } from '../AuthContext';
import { useRealtime } from '../socket';
import { colors, fmt, PAY_LABELS } from '../theme';

export default function OrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('open'); // 'open' | 'paid'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filter = user?.role === 'waiter' ? { waiter_id: user.id } : {};
      const [oo, inv] = await Promise.all([
        Api.listOrders({ ...filter, status: 'pending,serving' }),
        user?.role === 'cashier' || user?.role === 'admin'
          ? Api.listInvoices({ from: new Date(new Date().setHours(0,0,0,0)).toISOString() })
          : Promise.resolve([]),
      ]);
      setOrders(oo); setInvoices(inv);
    } finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: tự reload khi server có cập nhật
  const reloadRef = useRef(null);
  const scheduleReload = useCallback(() => {
    if (reloadRef.current) clearTimeout(reloadRef.current);
    reloadRef.current = setTimeout(() => { load(); }, 150);
  }, [load]);
  useRealtime({
    'orders:changed':   scheduleReload,
    'order:created':    scheduleReload,
    'order:updated':    scheduleReload,
    'order:cancelled':  scheduleReload,
    'invoice:created':  scheduleReload,
  });
  useEffect(() => () => { if (reloadRef.current) clearTimeout(reloadRef.current); }, []);

  const showOpen = tab === 'open';
  const data = showOpen ? orders : invoices;

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.title}>{user?.role === 'waiter' ? 'Đơn của tôi' : 'Đơn hàng'}</Text>
      </View>
      {(user?.role !== 'waiter') && (
        <View style={s.tabs}>
          <Tab label={`Đang mở (${orders.length})`} on={showOpen} onPress={() => setTab('open')} />
          <Tab label={`Đã TT hôm nay (${invoices.length})`} on={!showOpen} onPress={() => setTab('paid')} />
        </View>
      )}
      <FlatList
        data={data}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding:16, gap:10 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[colors.primary]} />}
        ListEmptyComponent={
          <View style={{ alignItems:'center', paddingTop:60 }}>
            <Ionicons name="receipt-outline" size={48} color={colors.muted}/>
            <Text style={{ color: colors.muted, marginTop:8 }}>Chưa có đơn nào.</Text>
          </View>
        }
        renderItem={({ item: o }) =>
          showOpen ? <OrderCard o={o}/> : <InvoiceCard inv={o}/>
        }
      />
    </View>
  );
}

function OrderCard({ o }) {
  const total = Number(o.total_amount);
  return (
    <View style={c.card}>
      <View style={c.cardHead}>
        <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
          <Ionicons name="restaurant" size={16} color={colors.primary}/>
          <Text style={c.tableName}>Bàn {o.table_code}</Text>
          <Text style={c.code}>{o.code}</Text>
        </View>
        <View style={[c.badge, o.status==='pending' ? c.badgePending : c.badgeServ]}>
          <Text style={c.badgeTxt}>{o.status==='pending' ? 'Chờ TT' : 'Đang phục vụ'}</Text>
        </View>
      </View>
      <View style={c.itemsWrap}>
        {(o.items || []).slice(0,3).map(it => (
          <View key={it.id} style={c.miniItem}>
            <Text style={c.miniTxt}>{it.item_name} ×{it.quantity}</Text>
          </View>
        ))}
        {o.items && o.items.length > 3 && (
          <View style={c.miniItem}><Text style={c.miniTxt}>+{o.items.length - 3} món</Text></View>
        )}
      </View>
      <View style={c.cardFoot}>
        <Text style={c.time}>{new Date(o.created_at).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</Text>
        <Text style={c.totalVal}>{fmt(total)}</Text>
      </View>
    </View>
  );
}

function InvoiceCard({ inv }) {
  return (
    <View style={c.card}>
      <View style={c.cardHead}>
        <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
          <Ionicons name="receipt" size={16} color={colors.success}/>
          <Text style={c.tableName}>Bàn {inv.table_code}</Text>
          <Text style={c.code}>{inv.code}</Text>
        </View>
        <View style={[c.badge, c.badgePaid]}>
          <Text style={c.badgeTxt}>Đã TT</Text>
        </View>
      </View>
      <View style={c.cardFoot}>
        <Text style={c.time}>{new Date(inv.created_at).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}  ·  {PAY_LABELS[inv.payment_method] || inv.payment_method}</Text>
        <Text style={c.totalVal}>{fmt(inv.final_amount)}</Text>
      </View>
    </View>
  );
}

function Tab({ label, on, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.tab, on && s.tabOn]}>
      <Text style={[s.tabTxt, on && s.tabTxtOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const c = StyleSheet.create({
  card:{ backgroundColor:'#fff', borderRadius:14, padding:12, borderWidth:1, borderColor: colors.borderSoft },
  cardHead:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  tableName:{ fontWeight:'700', color: colors.onSurface, fontSize:14 },
  code:{ fontFamily:'monospace', fontSize:10, color: colors.muted },
  badge:{ paddingHorizontal:8, paddingVertical:2, borderRadius:99 },
  badgePending:{ backgroundColor: colors.badgePay },
  badgeServ:{ backgroundColor: colors.badgeBusy },
  badgePaid:{ backgroundColor: colors.badgeFree },
  badgeTxt:{ fontSize:10, fontWeight:'700', color: colors.onSurface },
  itemsWrap:{ flexDirection:'row', flexWrap:'wrap', gap:4, marginTop:8 },
  miniItem:{ paddingHorizontal:8, paddingVertical:2, backgroundColor: colors.surfaceContainer, borderRadius:99 },
  miniTxt:{ fontSize:10, color: colors.onSurfaceVariant },
  cardFoot:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:8, paddingTop:8, borderTopWidth:1, borderTopColor: colors.borderSoft },
  time:{ color: colors.muted, fontSize:11 },
  totalVal:{ fontWeight:'700', color: colors.primary, fontSize:14 },
});

const s = StyleSheet.create({
  wrap:{ flex:1, backgroundColor: colors.surface },
  head:{ paddingHorizontal:16, paddingTop:16, paddingBottom:8 },
  title:{ fontSize:22, fontWeight:'700', color: colors.onSurface },
  tabs:{ flexDirection:'row', gap:6, paddingHorizontal:16, paddingBottom:8 },
  tab:{ paddingHorizontal:14, paddingVertical:8, borderRadius:99, borderWidth:1, borderColor: colors.border, backgroundColor:'#fff' },
  tabOn:{ backgroundColor: colors.primary, borderColor: colors.primary },
  tabTxt:{ fontSize:12, fontWeight:'600', color: colors.onSurfaceVariant },
  tabTxtOn:{ color:'#fff' },
});
