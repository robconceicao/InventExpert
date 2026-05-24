import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
    <View style={styles.container}>
      <Text style={styles.labelText}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={handleChange}
          placeholder="HH:mm"
          keyboardType="numeric"
          style={styles.textInput}
        />
        <Pressable
          onPress={handleNow}
          style={styles.buttonNow}>
          <Ionicons name="time" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  inputRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#0f172a',
    maxWidth: 120,
    minWidth: 110,
  },
  buttonNow: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
});
