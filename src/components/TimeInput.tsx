import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { formatTimeInputH, formatTimeNowH } from '../utils/timeFormat';

interface TimeInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export default function TimeInput({ label, value, onChange, required }: TimeInputProps) {
  const handleNow = () => {
    onChange(formatTimeNowH());
  };

  const handleChange = (text: string) => {
    onChange(formatTimeInputH(text));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <View style={styles.inputContainer}>
        <TextInput
          value={value}
          onChangeText={handleChange}
          placeholder="00h00"
          keyboardType="numeric"
          style={styles.input}
        />
        <Pressable
          onPress={handleNow}
          style={styles.button}>
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  inputContainer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#0F172A',
    maxWidth: 120,
    minWidth: 110,
  },
  button: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
});
