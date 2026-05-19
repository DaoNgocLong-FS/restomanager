// =============================================================================
//  PaymentScreen — thanh toán (validate bằng react-hook-form)
//
//  Hai field RHF (method, paid) không phải <TextInput> truyền thống nên dùng
//  `useController` để bind value/onChange imperatively rồi gọi field.onChange
//  trong các handler của keypad / nút phương thức / quick-amount.
// =============================================================================
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useForm, useController } from 'react-hook-form';
import { Api } from '../api';
import { useAuth } from '../AuthContext';
import { colors, fmt, PAY_METHODS, PAY_LABELS } from '../theme';
import { toast } from '../components/Notify';

const VALID_METHODS = PAY_METHODS.map(m => m.key);

export default function PaymentScreen({ route, navigation }) {
  const { order, table, sub, vat, total } = route.params || {};
  const { user } = useAuth();
  const [invoice, setInvoice] = useState(null);

  const { control, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { method: 'cash', paid: String(total || 0) },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  // Field "method" — đăng ký + lấy value/onChange/error
  const methodCtl = useController({
    name: 'method',
    control,
    rules: {
      required: 'Chọn phương thức thanh toán',
      validate: (v) => VALID_METHODS.includes(v) || 'Phương thức không hợp lệ',
    },
  });

  // Field "paid" — đăng ký với rule paid >= total
  const paidCtl = useController({
    name: 'paid',
    control,
    rules: {
      required: 'Nhập số tiền khách trả',
      validate: {
        isNumber: (v) => Number.isFinite(Number(v)) || 'Số tiền không hợp lệ',
        notNeg:   (v) => Number(v) >= 0          || 'Số tiền không được âm',
        enough:   (v) => Number(v) >= total      || `Khách trả thiếu, còn thiếu ${fmt(total - Number(v))}`,
      },
    },
  });

  const method  = methodCtl.field.value;
  const paid    = paidCtl.field.value;
  const paidErr = paidCtl.fieldState.error;
  const paidNum = Number(paid) || 0;
  const change  = Math.max(0, paidNum - total);
  const quickAmounts = [total, total + 5000, total + 10000, total + 50000, total + 100000, total + 200000];

  // Cập nhật paid qua keypad → gọi field.onChange (RHF re-render + re-validate)
  const onKey = (k) => {
    const cur = paid || '0';
    let next;
    if      (k === 'back')  next = cur.length <= 1 ? '0' : cur.slice(0, -1);
    else if (k === 'clear') next = '0';
    else if (k === '000')   next = (cur === '0' ? '0' : cur + '000');
    else                    next = (cur === '0' ? k   : cur + k);
    paidCtl.field.onChange(next);
  };

  const doCheckout = async ({ method, paid }) => {
    try {
      const inv = await Api.checkout(order.id, {
        cashier_name:   user?.full_name || 'Thu ngân',
        payment_method: method,
        vat_rate:       8,
        discount:       0,
        paid_amount:    Number(paid),
      });
      setInvoice(inv);
      toast.ok('Thanh toán thành công', `Hoá đơn ${inv?.code || ''}`);
    } catch (e) {
      toast.err('Thanh toán thất bại', e.message);
    }
  };

  const closeReceipt = () => {
    setInvoice(null);
    navigation.popToTop();
  };

  return (
    <SafeAreaView edges={['bottom']} style={s.wrap}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Bill summary */}
        <View style={s.card}>
          <View style={s.row}><Text style={s.muted}>Bàn</Text><Text style={s.bold}>{table.code}</Text></View>
          <View style={s.row}><Text style={s.muted}>Tạm tính</Text><Text>{fmt(sub)}</Text></View>
          <View style={s.row}><Text style={s.muted}>VAT (8%)</Text><Text>{fmt(vat)}</Text></View>
          <View style={[s.row, s.totalRow]}>
            <Text style={s.bold}>Cần thanh toán</Text>
            <Text style={s.totalVal}>{fmt(total)}</Text>
          </View>
        </View>

        {/* Phương thức thanh toán — bind vào RHF qua methodCtl */}
        <Text style={s.sectionTitle}>Phương thức thanh toán</Text>
        <View style={s.methods}>
          {PAY_METHODS.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[s.methodBox, method === m.key && s.methodBoxOn]}
              onPress={() => methodCtl.field.onChange(m.key)}
            >
              <Ionicons name={m.icon} size={20} color={method === m.key ? colors.primary : colors.muted} />
              <Text style={[s.methodTxt, method === m.key && { color: colors.primary, fontWeight: '700' }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {methodCtl.fieldState.error && (
          <Text style={s.fieldErr}>{methodCtl.fieldState.error.message}</Text>
        )}

        {/* Khách trả + keypad */}
        <View style={s.card}>
          <Text style={s.muted}>Khách trả</Text>
          <Text style={[s.paid, paidErr && { color: colors.error }]}>{fmt(paidNum)}</Text>
          {paidErr && <Text style={s.fieldErr}>{paidErr.message}</Text>}

          <View style={s.changeBox}>
            <Text style={s.muted}>Tiền thừa</Text>
            <Text style={s.changeVal}>{fmt(change)}</Text>
          </View>

          {/* Quick amounts */}
          <View style={s.quickWrap}>
            {quickAmounts.map((v) => (
              <TouchableOpacity
                key={v} style={s.quickBtn}
                onPress={() => paidCtl.field.onChange(String(v))}
              >
                <Text style={s.quickTxt}>{fmt(v)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Keypad */}
          <View style={s.keypad}>
            {[
              ['7', '8', '9', 'back'],
              ['4', '5', '6', 'clear'],
              ['1', '2', '3', '000'],
            ].map((row, ri) => (
              <View key={ri} style={s.keyRow}>
                {row.map(k => (
                  <TouchableOpacity
                    key={k}
                    style={[s.key, (k === 'back' || k === 'clear') && s.keyUtil]}
                    onPress={() => onKey(k)}
                  >
                    <Text style={s.keyTxt}>{k === 'back' ? '⌫' : k === 'clear' ? 'C' : k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <TouchableOpacity style={[s.key, s.keyWide]} onPress={() => onKey('0')}>
              <Text style={s.keyTxt}>0</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[s.confirmBtn, isSubmitting && { opacity: 0.6 }]}
          disabled={isSubmitting}
          onPress={handleSubmit(doCheckout)}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={s.confirmTxt}>{isSubmitting ? 'Đang xử lý…' : 'Xác nhận thanh toán'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Receipt modal */}
      <Modal visible={!!invoice} transparent animationType="slide" onRequestClose={closeReceipt}>
        <View style={s.modalBack}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <View>
                <Text style={s.bold}>Hoá đơn đã lưu</Text>
                <Text style={[s.muted, { fontSize: 11 }]}>{invoice?.code}</Text>
              </View>
              <TouchableOpacity onPress={closeReceipt}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 16 }}>
              <View style={s.kvGrid}>
                <Kv k="Bàn" v={invoice?.table_code} />
                <Kv k="Thu ngân" v={invoice?.cashier_name} />
                <Kv k="PT" v={PAY_LABELS[invoice?.payment_method] || invoice?.payment_method} />
                <Kv k="Lúc" v={invoice?.check_out_time && new Date(invoice.check_out_time).toLocaleString('vi-VN')} />
              </View>
              <View style={s.divider} />
              {(invoice?.items || []).map((i, idx) => (
                <View key={idx} style={s.invItemRow}>
                  <Text style={{ flex: 1 }}>{i.item_name}</Text>
                  <Text style={s.muted}>×{i.quantity}</Text>
                  <Text style={s.bold}>{fmt(i.total_price)}</Text>
                </View>
              ))}
              <View style={s.divider} />
              <View style={s.row}><Text style={s.muted}>Tạm tính</Text><Text>{fmt(invoice?.total_amount)}</Text></View>
              <View style={s.row}><Text style={s.muted}>VAT</Text><Text>{fmt(invoice?.vat_amount)}</Text></View>
              <View style={[s.row, s.totalRow]}>
                <Text style={s.bold}>Tổng</Text>
                <Text style={s.totalVal}>{fmt(invoice?.final_amount)}</Text>
              </View>
              <View style={s.row}><Text style={s.muted}>Khách trả</Text><Text>{fmt(invoice?.paid_amount ?? invoice?.final_amount)}</Text></View>
              <View style={s.row}><Text style={s.muted}>Tiền thừa</Text><Text style={{ color: colors.success, fontWeight: '700' }}>{fmt(invoice?.change_amount ?? 0)}</Text></View>
            </ScrollView>
            <TouchableOpacity style={s.modalBtn} onPress={closeReceipt}>
              <Text style={s.modalBtnTxt}>Hoàn tất</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Kv({ k, v }) {
  return (
    <View style={{ flexBasis: '50%', paddingVertical: 4 }}>
      <Text style={{ fontSize: 10, color: colors.muted, textTransform: 'uppercase' }}>{k}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.onSurface }}>{v || '–'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:         { flex: 1, backgroundColor: colors.surface },
  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.borderSoft },
  row:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalRow:     { borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 6, marginTop: 4 },
  totalVal:     { fontSize: 18, color: colors.primary, fontWeight: '700' },
  bold:         { fontWeight: '700', color: colors.onSurface, fontSize: 14 },
  muted:        { color: colors.muted, fontSize: 13 },
  sectionTitle: { fontWeight: '600', color: colors.onSurface, marginBottom: 8, marginLeft: 4 },
  methods:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  methodBox:    { flexBasis: '31%', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, alignItems: 'center', gap: 4 },
  methodBoxOn:  { borderColor: colors.primary, backgroundColor: colors.primaryContainer },
  methodTxt:    { fontSize: 11, color: colors.onSurfaceVariant, textAlign: 'center' },
  fieldErr:     { color: colors.error, fontSize: 12, marginTop: 4, marginBottom: 8 },
  paid:         { marginTop: 4, fontSize: 30, fontWeight: '700', color: colors.primary, textAlign: 'right' },
  changeBox:    { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.secondaryContainer, padding: 10, borderRadius: 10 },
  changeVal:    { fontWeight: '700', color: colors.secondary, fontSize: 15 },
  quickWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  quickBtn:     { flexBasis: '31%', backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  quickTxt:     { fontSize: 11, fontWeight: '600', color: colors.onSurface },
  keypad:       { marginTop: 14, gap: 8 },
  keyRow:       { flexDirection: 'row', gap: 8 },
  key:          { flex: 1, height: 48, backgroundColor: colors.surfaceLow, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  keyUtil:      { backgroundColor: colors.surfaceHigh },
  keyTxt:       { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  keyWide:      {},
  confirmBtn:   { height: 54, backgroundColor: colors.primary, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  confirmTxt:   { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Receipt modal
  modalBack:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal:        { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  kvGrid:       { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8 },
  divider:      { height: 1, backgroundColor: colors.borderSoft, marginVertical: 8 },
  invItemRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  modalBtn:     { margin: 16, height: 48, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalBtnTxt:  { color: '#fff', fontWeight: '700', fontSize: 15 },
});
