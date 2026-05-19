// =============================================================================
//  LoginScreen — đăng nhập mobile (validate bằng react-hook-form)
//
//  Khác web: TextInput của React Native KHÔNG nhận ref kiểu DOM input,
//  nên không thể dùng spread {...register(...)}. Phải dùng <Controller>
//  để bind value/onChangeText/onBlur vào field state của RHF.
// =============================================================================
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';
import { toast } from '../components/Notify';

export default function LoginScreen({ navigation }) {
  const { login, apiBase } = useAuth();
  const [serverErr, setServerErr] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { username: '', password: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const onSubmit = async ({ username, password }) => {
    if (!apiBase) {
      toast.info('Chưa cấu hình', 'Vào Cài đặt để nhập URL server.');
      return;
    }
    setServerErr('');
    try {
      const me = await login(username.trim(), password);
      if (me.role === 'admin') {
        toast.info('Tài khoản admin', 'Nên dùng phiên bản web. App này tối ưu cho waiter / cashier.');
      }
    } catch (e) {
      setServerErr(e.message || 'Đăng nhập thất bại');
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.flex}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.wrap}>
          <View style={s.brand}>
            <View style={s.logo}>
              <Ionicons name="restaurant" size={32} color="#fff" />
            </View>
            <Text style={s.appname}>RestoManager</Text>
            <Text style={s.tag}>Hệ thống quản lý nhà hàng</Text>
          </View>

          <View style={s.card}>
            <Text style={s.title}>Đăng nhập</Text>

            {/* Username field */}
            <Text style={s.label}>Tên đăng nhập</Text>
            <Controller
              control={control}
              name="username"
              rules={{
                required: 'Vui lòng nhập tên đăng nhập',
                minLength: { value: 1, message: 'Tên đăng nhập không hợp lệ' },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder=""
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[s.input, errors.username && s.inputErr]}
                />
              )}
            />
            {errors.username && (
              <Text style={s.fieldErr}>{errors.username.message}</Text>
            )}

            {/* Password field */}
            <Text style={s.label}>Mật khẩu</Text>
            <Controller
              control={control}
              name="password"
              rules={{
                required: 'Vui lòng nhập mật khẩu',
                minLength: { value: 1, message: 'Mật khẩu không hợp lệ' },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder=""
                  secureTextEntry
                  style={[s.input, errors.password && s.inputErr]}
                />
              )}
            />
            {errors.password && (
              <Text style={s.fieldErr}>{errors.password.message}</Text>
            )}

            {/* Lỗi server (sai pass, mất kết nối, ...) */}
            {!!serverErr && <Text style={s.err}>{serverErr}</Text>}

            <TouchableOpacity
              style={[s.btn, isSubmitting && { opacity: 0.6 }]}
              disabled={isSubmitting}
              onPress={handleSubmit(onSubmit)}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={18} color="#fff" />
                  <Text style={s.btnText}>Đăng nhập</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              style={s.settingsLink}
            >
              <Ionicons name="settings-outline" size={14} color={colors.muted} />
              <Text style={s.settingsTxt}>
                {apiBase ? 'Cài đặt server' : 'Cấu hình server (chưa thiết lập)'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex:    { flex: 1, backgroundColor: colors.primary },
  wrap:    { flex: 1, padding: 24, justifyContent: 'center' },
  brand:   { alignItems: 'center', marginBottom: 32 },
  logo:    { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  appname: { fontSize: 24, fontWeight: '700', color: '#fff' },
  tag:     { fontSize: 13, color: '#cdeef2', marginTop: 4 },
  card:    { backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  title:   { fontSize: 20, fontWeight: '700', color: colors.onSurface, marginBottom: 16 },
  label:   { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  input:   { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  inputErr:{ borderColor: colors.error },               // viền đỏ khi field có lỗi
  fieldErr:{ marginTop: 4, color: colors.error, fontSize: 12 },  // lỗi từng field
  err:     { marginTop: 10, color: colors.error, fontSize: 13 }, // lỗi server (chung)
  btn:     { marginTop: 18, height: 48, backgroundColor: colors.primary, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  settingsLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, padding: 6 },
  settingsTxt:  { color: colors.muted, fontSize: 12 },
});
