// Waiter / cashier-add-more: chọn món, gửi vào order (tạo mới hoặc append).
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Api } from '../api';
import { useAuth } from '../AuthContext';
import { colors, fmt } from '../theme';

export default function MenuScreen({ route, navigation }) {
  const table = route.params?.table;
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({});      // { menu_item_id: qty }
  const [openOrder, setOpenOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [m, c] = await Promise.all([Api.listMenu({ active:'true' }), Api.listCategories()]);
        setItems(m); setCats(c);
        if (table?.id) {
          try { setOpenOrder(await Api.getOpenOrderForTable(table.id)); } catch {}
        }
      } catch (e) {
        Alert.alert('Lỗi tải dữ liệu', e.message);
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    let arr = items;
    if (cat !== 'all') arr = arr.filter(x => x.category_code === cat || x.category_id === cat);
    if (search) arr = arr.filter(x => x.name.toLowerCase().includes(search.toLowerCase()));
    return arr;
  }, [items, cat, search]);

  const total = useMemo(() =>
    Object.entries(cart).reduce((s,[id,qty]) => {
      const it = items.find(x => x.id === id);
      return s + (it ? Number(it.price) * qty : 0);
    }, 0), [cart, items]);

  const count = Object.values(cart).reduce((s,q) => s+q, 0);

  const inc = (id) => setCart(c => ({ ...c, [id]: (c[id]||0)+1 }));
  const dec = (id) => setCart(c => {
    const next = { ...c };
    if ((next[id]||0) > 1) next[id]--; else delete next[id];
    return next;
  });

  const send = async () => {
    if (count === 0) { Alert.alert('Chưa có món','Thêm món trước khi gửi.'); return; }
    setSending(true);
    try {
      const apiItems = Object.entries(cart).map(([id,qty]) => {
        const it = items.find(x => x.id === id);
        return { menu_item_id: it.id, item_name: it.name, quantity: qty, price: Number(it.price) };
      });
      if (openOrder?.id) {
        await Api.addOrderItems(openOrder.id, apiItems);
      } else {
        await Api.createOrder({
          table_id: table.id,
          table_code: table.code,
          waiter_name: user?.full_name || user?.username || 'Waiter',
          items: apiItems,
        });
      }
      Alert.alert('Thành công', `Đã gửi ${count} món cho bàn ${table.code}`);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Gửi thất bại', e.message);
    } finally { setSending(false); }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={s.wrap}>
      <View style={s.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Tìm món…" style={s.searchInput}/>
      </View>
      <View style={s.chips}>
        <Chip label="Tất cả" on={cat==='all'} onPress={() => setCat('all')} />
        {cats.map(cc => (
          <Chip key={cc.id} label={cc.name} on={cat===cc.code || cat===cc.id} onPress={() => setCat(cc.code || cc.id)} />
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding:16, gap:10, paddingBottom: count>0 ? 100 : 24 }}
        renderItem={({ item }) => {
          const qty = cart[item.id] || 0;
          return (
            <View style={[s.card, qty>0 && s.cardOn]}>
              <View style={s.emoji}><Text style={{fontSize:28}}>{item.emoji || '🍽'}</Text></View>
              <View style={{ flex:1 }}>
                <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                <Text style={s.desc} numberOfLines={1}>{item.description || ''}</Text>
                <Text style={s.price}>{fmt(item.price)}</Text>
              </View>
              {qty === 0 ? (
                <TouchableOpacity style={s.addBtn} onPress={() => inc(item.id)}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              ) : (
                <View style={s.qtyBox}>
                  <TouchableOpacity style={s.qtyBtn} onPress={() => dec(item.id)}>
                    <Ionicons name="remove" size={18} color={colors.onSurface} />
                  </TouchableOpacity>
                  <Text style={s.qty}>{qty}</Text>
                  <TouchableOpacity style={s.addBtn} onPress={() => inc(item.id)}>
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={{textAlign:'center', color: colors.muted, marginTop:40}}>Không tìm thấy món.</Text>}
      />

      {count > 0 && (
        <TouchableOpacity style={[s.cartBar, sending && {opacity:0.6}]} disabled={sending} onPress={send}>
          <View style={s.cartLeft}>
            <Ionicons name="cart" size={20} color="#fff" />
            <Text style={s.cartTxt}>{count} món</Text>
          </View>
          <Text style={s.cartTotal}>{fmt(total)}</Text>
          <View style={s.cartSend}>
            <Text style={{color:'#fff', fontWeight:'700'}}>{openOrder?.id ? 'Thêm vào đơn' : 'Gửi'}</Text>
            <Ionicons name="send" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Chip({ label, on, onPress }) {
  return (
    <TouchableOpacity onPress={onPress}
      style={[chipS.chip, on ? chipS.chipOn : chipS.chipOff]}>
      <Text style={[chipS.chipTxt, on && {color:'#fff'}]}>{label}</Text>
    </TouchableOpacity>
  );
}
const chipS = StyleSheet.create({
  chip:{ paddingHorizontal:14, paddingVertical:6, borderRadius:99, borderWidth:1 },
  chipOn:{ backgroundColor: colors.primary, borderColor: colors.primary },
  chipOff:{ backgroundColor:'#fff', borderColor: colors.border },
  chipTxt:{ fontSize:12, fontWeight:'600', color: colors.onSurfaceVariant },
});

const s = StyleSheet.create({
  wrap:{ flex:1, backgroundColor: colors.surface },
  center:{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: colors.surface },
  search:{ flexDirection:'row', alignItems:'center', gap:8, margin:16, paddingHorizontal:14, paddingVertical:10, backgroundColor:'#fff', borderRadius:14, borderWidth:1, borderColor: colors.borderSoft },
  searchInput:{ flex:1, fontSize:14 },
  chips:{ flexDirection:'row', gap:8, paddingHorizontal:16, paddingBottom:8, flexWrap:'wrap' },
  card:{ flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'#fff', borderRadius:16, padding:10, borderWidth:1, borderColor: colors.borderSoft },
  cardOn:{ borderColor: colors.primary, borderWidth:2 },
  emoji:{ width:60, height:60, borderRadius:12, backgroundColor: colors.surfaceContainer, alignItems:'center', justifyContent:'center' },
  name:{ fontWeight:'700', color: colors.onSurface, fontSize:14 },
  desc:{ color: colors.muted, fontSize:11, marginTop:2 },
  price:{ color: colors.primary, fontWeight:'700', fontSize:14, marginTop:4 },
  addBtn:{ width:36, height:36, backgroundColor: colors.primary, borderRadius:10, alignItems:'center', justifyContent:'center' },
  qtyBox:{ flexDirection:'row', alignItems:'center', gap:6 },
  qtyBtn:{ width:36, height:36, backgroundColor: colors.surfaceContainer, borderRadius:10, alignItems:'center', justifyContent:'center' },
  qty:{ width:24, textAlign:'center', fontWeight:'700', fontSize:15 },
  cartBar:{ position:'absolute', bottom:16, left:16, right:16, height:54, backgroundColor: colors.primary, borderRadius:16, paddingHorizontal:16, flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  cartLeft:{ flexDirection:'row', alignItems:'center', gap:6 },
  cartTxt:{ color:'#fff', fontWeight:'700' },
  cartTotal:{ color:'#fff', fontWeight:'700', fontSize:16 },
  cartSend:{ flexDirection:'row', alignItems:'center', gap:4, backgroundColor: colors.primaryDark, paddingHorizontal:10, paddingVertical:6, borderRadius:10 },
});
