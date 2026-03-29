import { Linking, Pressable } from 'react-native';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { type PropsWithChildren } from 'react';

type Props = PropsWithChildren<{ href: string }>;

export function ExternalLink({ href, children, ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      onPress={async () => {
        if (process.env.EXPO_OS !== 'web') {
          // Open the link in an in-app browser on native.
          await openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        } else {
          // Open in a new tab on web.
          Linking.openURL(href);
        }
      }}
    >
      {children}
    </Pressable>
  );
}
