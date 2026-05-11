import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../AuthContext';
import { Api, getApiBase } from '../api';
import { colors, fmt, PAY_LABELS } from '../theme';
import { useFocusEffect } from '@react-navigation/native';
import { useConfirm, toast } from '../components/Notify';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const confirm = useConfirm();

  useFocusEffect(React.useCallback(() => {
    if (user?.role === 'cashier' || user?.role === 'admin') {
      Api.statsOverview().then(setStats).catch(()=>{});
    }
  }, [user]));

  const doLogout = async () => {
    const ok = await confirm({
      title: 'Đăng xuất?',
      message: 'Bạn cần đăng nhập lại để dùng tiếp.',
      okText: 'Đăng xuất',
      cancelText: 'Huỷ',
      danger: true,
    });
    if (!ok) return;
    await logout();
    toast.ok('Đã đăng xuất');
  };

  return (
    <SafeAreaView edges={['top']} style={s.wrap}>
      <ScrollView contentContainerStyle={{ padding:16 }}>
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{(user?.full_name || user?.username || 'U').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={s.name}>{user?.full_name || user?.username}</Text>
          <Text style={s.role}>{user?.role}</Text>
        </View>

        {stats && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Hôm nay</Text>
            <View style={s.kpiRow}>
              <KPI icon="cash-outline" label="Doanh thu" value={fmt(stats.summary?.total_revenue)} />
              <KPI icon="receipt-outline" label="Hoá đơn" value={String(stats.summary?.invoice_count || 0)} />
            </View>
            {stats.byPaymentMethod && stats.byPaymentMethod.length > 0 && (
              <View style={s.pmCard}>
                <Text style={s.pmTitle}>Phương thức TT</Text>
                {stats.byPaymentMethod.map(p => (
                  <View key={p.payment_method} style={s.pmRow}>
                    <Text style={{ color: colors.muted }}>{PAY_LABELS[p.payment_method] || p.payment_method}</Text>
                    <Text style={{ fontWeight:'600' }}>{p.count} HĐ · {fmt(p.revenue)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Cài đặt</Text>
          <Item icon="server-outline" label="Server" value={getApiBase() || '–'} onPress={() => navigation.navigate('Settings')} />
          <Item icon="information-circle-outline" label="Phiên bản" value="1.0.0" />
        </View>

        <TouchableOpacity style={s.logoutBtn} onPress={doLogout}>
          <Ionicons name="log-out-outline" size={18} color={colors.error}/>
          <Text style={s.logoutTxt}>Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function KPI({ icon, label, value }) {
  return (
    <View style={s.kpi}>
      <Ionicons name={icon} size={18} color={colors.primary}/>
      <Text style={{ color: colors.muted, fontSize:11, marginTop:6 }}>{label}</Text>
      <Text style={{ fontSize:16, fontWeight:'700', color: colors.onSurface, marginTop:2 }}>{value}</Text>
    </View>
  );
}

function Item({ icon, label, value, onPress }) {
  const inner = (
    <View style={s.item}>
      <Ionicons name={icon} size={18} color={colors.muted} />
      <Text style={{ flex:1, fontSize:14, color: colors.onSurface }}>{label}</Text>
      <Text style={{ fontSize:12, color: colors.muted }} numberOfLines={1}>{value}</Text>
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.muted}/>}
    </View>
  );
  return onPress ? <TouchableOpacity onPress={onPress}>{inner}</TouchableOpacity> : inner;
}

const s = StyleSheet.create({
  wrap:{ flex:1, backgroundColor: colors.surface },
  profileCard:{ backgroundColor:'#fff', borderRadius:16, padding:20, alignItems:'center', borderWidth:1, borderColor: colors.borderSoft },
  avatar:{ width:64, height:64, borderRadius:32, backgroundColor: colors.primary, alignItems:'center', justifyContent:'center', marginBottom:8 },
  avatarTxt:{ color:'#fff', fontSize:24, fontWeight:'700' },
  name:{ fontSize:18, fontWeight:'700', color: colors.onSurface },
  role:{ fontSize:13, color: colors.muted, marginTop:2, textTransform:'capitalize' },
  section:{ marginTop:18 },
  sectionTitle:{ fontSize:13, fontWeight:'700', color: colors.muted, textTransform:'uppercase', marginBottom:8, marginLeft:4 },
  kpiRow:{ flexDirection:'row', gap:8 },
  kpi:{ flex:1, backgroundColor:'#fff', borderRadius:14, padding:14, borderWidth:1, borderColor: colors.borderSoft },
  pmCard:{ marginTop:8, backgroundColor:'#fff', borderRadius:14, padding:14, borderWidth:1, borderColor: colors.borderSoft },
  pmTitle:{ fontSize:13, fontWeight:'700', marginBottom:8, color: colors.onSurface },
  pmRow:{ flexDirection:'row', justifyContent:'space-between', paddingVertical:4 },
  item:{ flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'#fff', padding:14, borderBottomWidth:1, borderBottomColor: colors.borderSoft },
  logoutBtn:{ marginTop:24, marginBottom:24, height:48, backgroundColor: colors.errorContainer, borderRadius:12, flexDirection:'row', gap:6, alignItems:'center', justifyContent:'center' },
  logoutTxt:{ color: colors.error, fontWeight:'700' },
});
