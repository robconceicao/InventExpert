import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/src/services/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const trimmedEmail = useMemo(() => email.trim(), [email]);

  const translateAuthError = (message: string) => {
    if (message.includes('Email not confirmed')) {
      return 'E-mail ainda não confirmado. Verifique sua caixa de entrada e spam.';
    }
    if (message.includes('Invalid login credentials')) {
      return 'E-mail ou senha inválidos.';
    }
    if (message.includes('User already registered')) {
      return 'E-mail já cadastrado. Use Entrar ou Reenviar confirmação.';
    }
    return message;
  };

  const handleSignIn = async () => {
    if (!supabase) {
      Alert.alert('Configuração ausente', 'Informe as chaves do Supabase no app.json.');
      return;
    }
    if (!trimmedEmail || !password) {
      Alert.alert('Campos obrigatórios', 'Informe e-mail e senha.');
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        Alert.alert('Erro', translateAuthError(error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!supabase) {
      Alert.alert('Configuração ausente', 'Informe as chaves do Supabase no app.json.');
      return;
    }
    if (!trimmedEmail || !password) {
      Alert.alert('Campos obrigatórios', 'Informe e-mail e senha.');
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });
      if (error) {
        Alert.alert('Erro', translateAuthError(error.message));
        return;
      }
      if (data.session) {
        Alert.alert('Conta criada', 'Login efetuado com sucesso.');
        return;
      }
      if (data.user?.identities?.length === 0) {
        Alert.alert('Conta já existe', 'Use Entrar ou Reenviar confirmação.');
        return;
      }
      Alert.alert(
        'Conta criada',
        'Confirme o e-mail para ativar sua conta e depois faça login.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!supabase) {
      Alert.alert('Configuração ausente', 'Informe as chaves do Supabase no app.json.');
      return;
    }
    if (!trimmedEmail) {
      Alert.alert('E-mail obrigatório', 'Digite o e-mail para reenviar a confirmação.');
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
      });
      if (error) {
        Alert.alert('Erro', translateAuthError(error.message));
        return;
      }
      Alert.alert('Confirmação enviada', 'Confira seu e-mail e a caixa de spam.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-slate-50 px-6">
      <View className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm">
        <Text className="text-lg font-semibold text-slate-800">InventExpert</Text>
        <Text className="mt-2 text-sm text-slate-600">
          Crie sua conta com e-mail e senha. Se a confirmação estiver ativa no Supabase, confirme
          no e-mail e depois faça login.
        </Text>

        {!isSupabaseConfigured ? (
          <Text className="mt-4 text-sm text-rose-600">
            Configure as chaves do Supabase no `app.json` para continuar.
          </Text>
        ) : null}

        <View className="mt-4">
          <Text className="text-sm font-semibold text-slate-700">E-mail</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="seu@email.com"
            className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
          />
        </View>

        <View className="mt-3">
          <Text className="text-sm font-semibold text-slate-700">Senha</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
            className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
          />
        </View>

        <Pressable
          onPress={handleSignIn}
          className="mt-5 items-center rounded-lg bg-blue-600 py-2"
          disabled={loading}>
          <Text className="text-sm font-semibold text-white">
            {loading ? 'Entrando...' : 'Entrar'}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleSignUp}
          className="mt-2 items-center rounded-lg bg-slate-200 py-2"
          disabled={loading}>
          <Text className="text-sm font-semibold text-slate-700">Criar conta</Text>
        </Pressable>
        <Pressable
          onPress={handleResendConfirmation}
          className="mt-2 items-center rounded-lg border border-slate-200 py-2"
          disabled={loading}>
          <Text className="text-sm font-semibold text-slate-700">
            Reenviar confirmação
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
