/**
 * react-native web stub for Vitest/jsdom test environment.
 *
 * Provides basic implementations of RN primitives using HTML elements
 * so that components can be rendered and tested in jsdom.
 */
import React from 'react';

export const View = ({ children, style, testID, ...props }) =>
  React.createElement('div', { 'data-testid': testID, style, ...props }, children);

export const Text = ({ children, style, testID, ...props }) =>
  React.createElement('span', { 'data-testid': testID, style, ...props }, children);

export const TextInput = ({ style, testID, value, onChangeText, onFocus, onBlur, secureTextEntry, editable, placeholder, ...props }) =>
  React.createElement('input', {
    'data-testid': testID,
    style,
    value: value || '',
    type: secureTextEntry ? 'password' : 'text',
    disabled: editable === false,
    placeholder,
    onChange: (e) => onChangeText && onChangeText(e.target.value),
    onFocus: () => onFocus && onFocus(),
    onBlur: () => onBlur && onBlur(),
    readOnly: editable === false,
    ...props,
  });

export const TouchableOpacity = ({ children, style, testID, onPress, disabled, activeOpacity, ...props }) =>
  React.createElement(
    'button',
    {
      'data-testid': testID,
      style,
      disabled,
      onClick: disabled ? undefined : onPress,
      ...props,
    },
    children
  );

export const StyleSheet = {
  create: (styles) => styles,
};

export const Platform = {
  OS: 'web',
  select: (obj) => obj.web || obj.default,
};

export const Dimensions = {
  get: () => ({ width: 375, height: 812 }),
};

export const Alert = {
  alert: () => {},
};

export const ActivityIndicator = ({ testID, ...props }) =>
  React.createElement('div', { 'data-testid': testID, role: 'progressbar', ...props });

export const ScrollView = ({ children, style, testID, ...props }) =>
  React.createElement('div', { 'data-testid': testID, style, ...props }, children);

export const FlatList = ({ data, renderItem, keyExtractor, testID, ...props }) =>
  React.createElement(
    'div',
    { 'data-testid': testID, ...props },
    (data || []).map((item, index) =>
      React.createElement(
        'div',
        { key: keyExtractor ? keyExtractor(item, index) : index },
        renderItem({ item, index })
      )
    )
  );

export const KeyboardAvoidingView = ({ children, style, testID, ...props }) =>
  React.createElement('div', { 'data-testid': testID, style, ...props }, children);

export const SafeAreaView = ({ children, style, testID, ...props }) =>
  React.createElement('div', { 'data-testid': testID, style, ...props }, children);

export const Image = ({ testID, source, style, ...props }) =>
  React.createElement('img', { 'data-testid': testID, style, src: source?.uri || source, ...props });

export const Pressable = ({ children, style, testID, onPress, disabled, ...props }) =>
  React.createElement(
    'button',
    {
      'data-testid': testID,
      style,
      disabled,
      onClick: disabled ? undefined : onPress,
      ...props,
    },
    typeof children === 'function' ? children({ pressed: false }) : children
  );

export const Modal = ({ children, visible, testID, ...props }) =>
  visible
    ? React.createElement('div', { 'data-testid': testID, role: 'dialog', ...props }, children)
    : null;

export const Switch = ({ testID, value, onValueChange, disabled, ...props }) =>
  React.createElement('input', {
    type: 'checkbox',
    'data-testid': testID,
    checked: value,
    disabled,
    onChange: (e) => onValueChange && onValueChange(e.target.checked),
    ...props,
  });

export default {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  SafeAreaView,
  Image,
  Pressable,
  Modal,
  Switch,
};
