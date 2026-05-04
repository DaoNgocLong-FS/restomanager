import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';

export default function LoginScreen({ navigation }) {
  const { login, apiBase } = useAuth();
  const [u, setU] = useState('waiter');
  const [p, setP] = useState('123');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!apiBase) {
      Alert.alert('Chưa cấu hình', 'Vào Cài đặt để nhập URL server.');
      return;
    }
    setBusy(true); setErr('');
    try {
      const me = await login(u.trim(), p);
      if (me.role === 'admin') {
        Alert.alert('Lưu ý', 'Tài khoản admin nên dùng phiên bản web. App này dành cho waiter / cashier.');
      }
    } catch (e) {
      setErr(e.message || 'Đăng nhập thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
      <View style={s.wrap}>
        <View style={s.brand}>
          <View style={s.logo}><Ionicons name="restaurant" size={32} color="#fff" /></View>
          <Text style={s.appname}>RestoManager</Text>
          <Text style={s.tag}>Hệ thống quản lý nhà hàng</Text>
        </View>

        <View style={s.card}>
          <Text style={s.title}>Đăng nhập</Text>

          <Text style={s.label}>Tên đăng nhập</Text>
          <TextInput value={u} onChangeText={setU} placeholder="waiter / cashier"
            autoCapitalize="none" autoCorrect={false} style={s.input}/>

          <Text style={s.label}>Mật khẩu</Text>
          <TextInput value={p} onChangeText={setP} placeholder="••••" secureTextEntry style={s.input}/>

          {!!err && <Text style={s.err}>{err}</Text>}

          <TouchableOpacity style={[s.btn, busy && {opacity:0.6}]} disabled={busy} onPress={submit}>
            {busy ? <ActivityIndicator color="#fff" />
              : (<><Ionicons name="log-in-outline" size={18} color="#fff" /><Text style={s.btnText}>Đăng nhập</Text></>)}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={s.settingsLink}>
            <Ionicons name="settings-outline" size={14} color={colors.muted} />
            <Text style={s.settingsTxt}>{apiBase ? 'Cài đặt server' : 'Cấu hình server (chưa thiết lập)'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:{ flex:1, backgroundColor: colors.primary },
  wrap:{ flex:1, padding:24, justifyContent:'center' },
  brand:{ alignItems:'center', marginBottom:32 },
  logo:{ width:64, height:64, borderRadius:18, backgroundColor: colors.primaryDark, alignItems:'center', justifyContent:'center', marginBottom:12 },
  appname:{ fontSize:24, fontWeight:'700', color:'#fff' },
  tag:{ fontSize:13, color:'#cdeef2', marginTop:4 },
  card:{ backgroundColor:'#fff', borderRadius:20, padding:24 },
  title:{ fontSize:20, fontWeight:'700', color: colors.onSurface, marginBottom:16 },
  label:{ fontSize:12, color: colors.onSurfaceVariant, fontWeight:'600', marginBottom:6, marginTop:8 },
  input:{ borderWidth:1, borderColor: colors.border, borderRadius:12, paddingHorizontal:14, paddingVertical:12, fontSize:15 },
  err:{ marginTop:10, color: colors.error, fontSize:13 },
  btn:{ marginTop:18, height:48, backgroundColor: colors.primary, borderRadius:12, flexDirection:'row', gap:8, alignItems:'center', justifyContent:'center' },
  btnText:{ color:'#fff', fontWeight:'700', fontSize:15 },
  settingsLink:{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, marginTop:14, padding:6 },
  settingsTxt:{ color: colors.muted, fontSize:12 },
});
