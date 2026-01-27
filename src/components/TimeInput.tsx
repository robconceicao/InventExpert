import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { formatTimeInput, formatTimeNow } from '@/src/utils/parsers';

interface TimeInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export default function TimeInput({ label, value, onChange, required }: TimeInputProps) {
  const handleNow = () => {
    onChange(formatTimeNow());
  };

  const handleChange = (text: string) => {
    onChange(formatTimeInput(text));
  };

  return (
    <View className="mb-3">
      <Text className="text-sm font-semibold text-slate-700">
        {label}
        {required ? ' *' : ''}
      </Text>
      <View className="mt-2 flex-row items-center gap-2">
        <TextInput
          value={value}
          onChangeText={handleChange}
          placeholder="HH:mm"
          keyboardType="numeric"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
          style={{ maxWidth: 120, minWidth: 110 }}
        />
        <Pressable
          onPress={handleNow}
          className="h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
          <Ionicons name="time" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
