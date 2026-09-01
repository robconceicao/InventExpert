import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetchTadeuLicense, signInTadeuApps } from '../services/tadeuLicense';

type Props = {
  onActivated: () => void;
};

export default function TadeuLicenseScreen({ onActivated }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const activate = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Dados incompletos', 'Informe o e-mail e a senha usados na Tadeu Apps.');
      return;
    }

    try {
      setLoading(true);
      await signInTadeuApps(email, password);
      await fetchTadeuLicense();
      onActivated();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('Invalid login credentials')) {
        Alert.alert('Não foi possível entrar', 'E-mail ou senha da Tadeu Apps inválidos.');
      } else if (message.startsWith('TADEU_LICENSE_DENIED:')) {
        Alert.alert(
          'Sem licença ativa',
          'Sua conta Tadeu Apps não possui uma assinatura ativa do InventExpert. Acesse a loja para escolher Gratuito, Pro ou Premium.',
        );
      } else {
        Alert.alert('Falha na validação', 'Não foi possível validar sua licença agora. Verifique a internet e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Tadeu Apps</Text>
        <Text style={styles.title}>Ativar licença do InventExpert</Text>
        <Text style={styles.text}>
          Use a mesma conta da Tadeu Apps em que você ativou o plano Gratuito, Pro ou Premium.
        </Text>

        <Text style={styles.label}>E-mail</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          placeholder="seu@email.com"
        />

        <Text style={styles.label}>Senha</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholder="Senha da Tadeu Apps"
        />

        <Pressable disabled={loading} onPress={() => void activate()} style={styles.button}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Validar licença</Text>}
        </Pressable>

        <Text style={styles.note}>
          A licença é revalidada periodicamente. Após uma validação bem-sucedida, o app pode continuar funcionando por até 24 horas sem conexão.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F1F5F9', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  eyebrow: { color: '#2563EB', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { marginTop: 8, fontSize: 26, fontWeight: '800', color: '#0F172A' },
  text: { marginTop: 10, color: '#475569', lineHeight: 20, marginBottom: 20 },
  label: { fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#fff' },
  button: { marginTop: 22, backgroundColor: '#2563EB', borderRadius: 10, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '800' },
  note: { marginTop: 16, color: '#64748B', fontSize: 12, lineHeight: 17 },
});
