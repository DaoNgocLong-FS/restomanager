// Cashier xem chi tiết bàn, sửa món, đi tới thanh toán.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Api } from '../api';
import { useRealtime } from '../socket';
import { colors, fmt } from '../theme';
import { toast, useConfirm } from '../components/Notify';

export default function DetailScreen({ route, navigation }) {
  const table = route.params?.table;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    if (!table?.id) return;
    setLoading(true);
    try {
      const o = await Api.getOpenOrderForTable(table.id);
      setOrder(o);
    } catch (e) {
      toast.err('Lỗi tải đơn', e.message);
    } finally { setLoading(false); }
  }, [table?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: chỉ reload khi event liên quan tới bàn này
  const reloadRef = useRef(null);
  const scheduleReload = useCallback((p) => {
    const tableCode = p && (p.table_code || (p.order && p.order.table_code) || (p.invoice && p.invoice.table_code));
    if (tableCode && table?.code && tableCode !== table.code) return;
    if (reloadRef.current) clearTimeout(reloadRef.current);
    reloadRef.current = setTimeout(() => { load(); }, 120);
  }, [load, table?.code]);
  useRealtime({
    'orders:changed':   scheduleReload,
    'order:updated':    scheduleReload,
    'order:created':    scheduleReload,
    'order:cancelled':  scheduleReload,
    'invoice:created':  scheduleReload,
    'tables:changed':   scheduleReload,
  });
  useEffect(() => () => { if (reloadRef.current) clearTimeout(reloadRef.current); }, []);

  const items = order?.items || [];
  const sub = items.reduce((s,i)=> s + Number(i.price)*i.quantity, 0);
  const vat = Math.round(sub * 0.08);
  const total = sub + vat;

  const inc = async (it) => {
    try { await Api.updateOrderItem(order.id, it.id, { quantity: it.quantity+1 }); load(); }
    catch(e){ toast.err('Không thể tăng số lượng', e.message); }
  };
  const dec = async (it) => {
    try {
      if (it.quantity <= 1) await Api.removeOrderItem(order.id, it.id);
      else await Api.updateOrderItem(order.id, it.id, { quantity: it.quantity-1 });
      load();
    } catch(e){ toast.err('Không thể giảm số lượng', e.message); }
  };
  const del = async (it) => {
    const ok = await confirm({
      title: `Xoá "${it.item_name}"?`,
      message: 'Món sẽ được gỡ khỏi đơn.',
      okText: 'Xoá',
      cancelText: 'Huỷ',
      danger: true,
    });
    if (!ok) return;
    try { await Api.removeOrderItem(order.id, it.id); load(); toast.ok('Đã xoá món'); }
    catch(e){ toast.err('Không thể xoá', e.message); }
  };

  return (
    <SafeAreaView edges={['bottom']} style={s.wrap}>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:240 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[colors.primary]} />}>
        <View style={s.head}>
          <View style={s.headLeft}>
            <Ionicons name="restaurant" size={20} color={colors.primary} />
            <View>
              <Text style={s.tableName}>Bàn {table.code}</Text>
              <Text style={s.tableMeta}>{table.zone} · {table.capacity} chỗ</Text>
            </View>
          </View>
        </View>

        {loading && !order && <ActivityIndicator color={colors.primary} style={{marginTop:24}}/>}

        {!loading && (!order || items.length === 0) ? (
          <View style={s.emptyBox}>
            <Ionicons name="receipt-outline" size={48} color={colors.muted}/>
            <Text style={s.emptyTxt}>Chưa có món nào ở bàn này.</Text>
            <TouchableOpacity style={s.addMoreBtn} onPress={() => navigation.navigate('Menu', { table })}>
              <Ionicons name="add" size={18} color="#fff"/>
              <Text style={s.addMoreTxt}>Thêm món</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {order && items.length > 0 && (
          <>
            <TouchableOpacity style={s.addMoreBtn} onPress={() => navigation.navigate('Menu', { table })}>
              <Ionicons name="add" size={18} color="#fff"/>
              <Text style={s.addMoreTxt}>Thêm món vào đơn</Text>
            </TouchableOpacity>
            <View style={s.orderCard}>
              <View style={s.orderHead}>
                <Text style={s.orderCode}>{order.code}</Text>
                <Text style={s.orderTime}>{new Date(order.created_at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</Text>
              </View>
              {items.map((it) => (
                <View key={it.id} style={s.itemRow}>
                  <View style={{flex:1}}>
                    <Text style={s.itemName}>{it.item_name}</Text>
                    <Text style={s.itemPrice}>{fmt(it.price)} × {it.quantity} = <Text style={{color: colors.primary, fontWeight:'700'}}>{fmt(Number(it.price)*it.quantity)}</Text></Text>
                  </View>
                  <View style={s.itemActions}>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => dec(it)}>
                      <Ionicons name="remove" size={16} color={colors.onSurface}/>
                    </TouchableOpacity>
                    <Text style={s.qty}>{it.quantity}</Text>
                    <TouchableOpacity style={s.qtyBtnOn} onPress={() => inc(it)}>
                      <Ionicons name="add" size={16} color="#fff"/>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.delBtn} onPress={() => del(it)}>
                      <Ionicons name="trash-outline" size={16} color={colors.error}/>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {order && items.length > 0 && (
        <View style={s.footer}>
          <View style={s.row}><Text style={s.smTxt}>Tạm tính</Text><Text style={s.smVal}>{fmt(sub)}</Text></View>
          <View style={s.row}><Text style={s.smTxt}>VAT (8%)</Text><Text style={s.smVal}>{fmt(vat)}</Text></View>
          <View style={[s.row, s.totalRow]}>
            <Text style={s.totalTxt}>Tổng cộng</Text>
            <Text style={s.totalVal}>{fmt(total)}</Text>
          </View>
          <TouchableOpacity style={s.payBtn}
            onPress={() => navigation.navigate('Payment', { order, table, sub, vat, total })}>
            <Ionicons name="cash-outline" size={18} color="#fff"/>
            <Text style={s.payTxt}>Thanh toán</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap:{ flex:1, backgroundColor: colors.surface },
  head:{ backgroundColor:'#fff', borderRadius:16, padding:14, marginBottom:14, borderWidth:1, borderColor: colors.borderSoft },
  headLeft:{ flexDirection:'row', alignItems:'center', gap:10 },
  tableName:{ fontSize:16, fontWeight:'700', color: colors.onSurface },
  tableMeta:{ fontSize:12, color: colors.muted, marginTop:2 },
  emptyBox:{ alignItems:'center', paddingVertical:40, gap:10 },
  emptyTxt:{ color: colors.muted },
  addMoreBtn:{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, backgroundColor: colors.primary, height:42, borderRadius:12, marginBottom:14 },
  addMoreTxt:{ color:'#fff', fontWeight:'700', fontSize:14 },
  orderCard:{ backgroundColor:'#fff', borderRadius:16, borderWidth:1, borderColor: colors.borderSoft, overflow:'hidden' },
  orderHead:{ paddingHorizontal:14, paddingVertical:10, backgroundColor: colors.surfaceLow, borderBottomWidth:1, borderBottomColor: colors.borderSoft, flexDirection:'row', justifyContent:'space-between' },
  orderCode:{ fontFamily: 'monospace', fontSize:11, color: colors.onSurfaceVariant, fontWeight:'700' },
  orderTime:{ fontSize:11, color: colors.muted },
  itemRow:{ flexDirection:'row', alignItems:'center', padding:12, gap:8, borderTopWidth:1, borderTopColor: colors.borderSoft },
  itemName:{ fontWeight:'600', color: colors.onSurface, fontSize:14 },
  itemPrice:{ color: colors.muted, fontSize:11, marginTop:2 },
  itemActions:{ flexDirection:'row', alignItems:'center', gap:6 },
  qtyBtn:{ width:32, height:32, borderRadius:99, backgroundColor: colors.surfaceContainer, alignItems:'center', justifyContent:'center' },
  qtyBtnOn:{ width:32, height:32, borderRadius:99, backgroundColor: colors.primary, alignItems:'center', justifyContent:'center' },
  qty:{ width:22, textAlign:'center', fontWeight:'700' },
  delBtn:{ width:32, height:32, borderRadius:99, backgroundColor: colors.errorContainer, alignItems:'center', justifyContent:'center', marginLeft:4 },
  footer:{ position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#fff', borderTopLeftRadius:20, borderTopRightRadius:20, padding:16, gap:6, shadowColor:'#000', shadowOpacity:0.06, shadowOffset:{width:0,height:-4}, shadowRadius:8, elevation:8 },
  row:{ flexDirection:'row', justifyContent:'space-between' },
  smTxt:{ color: colors.muted, fontSize:13 },
  smVal:{ fontSize:13, fontWeight:'600' },
  totalRow:{ borderTopWidth:1, borderTopColor: colors.borderSoft, paddingTop:6, marginTop:4 },
  totalTxt:{ fontWeight:'700', fontSize:16 },
  totalVal:{ fontWeight:'700', fontSize:18, color: colors.primary },
  payBtn:{ marginTop:8, height:48, backgroundColor: colors.primary, borderRadius:12, flexDirection:'row', gap:8, alignItems:'center', justifyContent:'center' },
  payTxt:{ color:'#fff', fontWeight:'700', fontSize:15 },
});
