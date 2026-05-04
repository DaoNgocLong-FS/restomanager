import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Api, getApiBase, setApiBase } from '../api';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';

export default function SettingsScreen({ navigation }) {
  const { updateBase } = useAuth();
  const [url, setUrl] = useState(getApiBase() || 'http://192.168.1.10:3000/api');
  const [busy, setBusy] = useState(false);

  const test = async () => {
    setBusy(true);
    const trimmed = url.trim().replace(/\/+$/, '');
    await setApiBase(trimmed);
    updateBase(trimmed);
    try {
      await Api.health();
      Alert.alert('Thành công', 'Kết nối server OK!');
      // Đợi một beat để parent re-render kịp tạo stack mới (có Login)
      requestAnimationFrame(() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          // Lần đầu: reset hẳn về màn Login
          try {
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          } catch (_) {
            // Login chưa kịp đăng ký — parent re-render đang xử lý, kệ
          }
        }
      });
    } catch (e) {
      Alert.alert('Thất bại', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView style={s.flex} contentContainerStyle={s.wrap}>
        <View style={s.iconBox}>
          <Ionicons name="settings-outline" size={48} color={colors.primary} />
        </View>
        <Text style={s.title}>Cấu hình server</Text>
        <Text style={s.hint}>Nhập địa chỉ API của backend RestoManager. Điện thoại và máy chủ phải cùng mạng Wi-Fi.</Text>

        <Text style={s.label}>URL API</Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="http://192.168.1.10:3000/api"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={s.input}
        />
        <Text style={s.helper}>Mặc định: <Text style={s.mono}>http://&lt;IP-LAN&gt;:3000/api</Text></Text>

        <TouchableOpacity style={[s.btn, busy && s.btnDisabled]} disabled={busy} onPress={test}>
          <Ionicons name="cloud-done-outline" size={18} color="#fff" />
          <Text style={s.btnText}>{busy ? 'Đang kiểm tra…' : 'Lưu & Kiểm tra'}</Text>
        </TouchableOpacity>

        {navigation.canGoBack() && (
          <TouchableOpacity style={s.btnGhost} onPress={() => navigation.goBack()}>
            <Text style={s.btnGhostText}>Hủy</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex:1, backgroundColor: colors.surface },
  wrap: { padding:24, alignItems:'center' },
  iconBox: { width:80, height:80, borderRadius:20, backgroundColor: colors.primaryContainer, alignItems:'center', justifyContent:'center', marginVertical:24 },
  title: { fontSize:22, fontWeight:'700', color: colors.onSurface, marginBottom:8 },
  hint:  { fontSize:13, color: colors.muted, textAlign:'center', marginBottom:24, lineHeight:18 },
  label: { alignSelf:'flex-start', fontSize:13, color: colors.onSurfaceVariant, marginBottom:6, marginTop:8, fontWeight:'600' },
  input: { width:'100%', backgroundColor:'#fff', borderWidth:1, borderColor: colors.border, borderRadius:12, paddingHorizontal:14, paddingVertical:12, fontSize:15, color: colors.onSurface },
  helper:{ alignSelf:'flex-start', fontSize:12, color: colors.muted, marginTop:6 },
  mono:  { fontFamily: Platform.OS==='ios' ? 'Menlo' : 'monospace' },
  btn:   { width:'100%', height:48, backgroundColor: colors.primary, borderRadius:12, flexDirection:'row', gap:8, alignItems:'center', justifyContent:'center', marginTop:24 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color:'#fff', fontWeight:'700', fontSize:15 },
  btnGhost:{ marginTop:12, padding:8 },
  btnGhostText: { color: colors.muted, fontSize:14 },
});
