import {
  MENSAGEM_ERRO_REDE,
  isNetworkAuthError,
  translateAuthError,
  translateThrownAuthError,
} from '../authErrorMessage';

describe('translateAuthError', () => {
  it.each([
    'Network request failed',
    'TypeError: Failed to fetch',
    'network error',
    'Load failed',
    'fetch failed',
    'The request timed out',
  ])('traduz falha de rede: %s', (mensagem) => {
    expect(isNetworkAuthError(mensagem)).toBe(true);
    expect(translateAuthError(mensagem)).toBe(MENSAGEM_ERRO_REDE);
  });

  it('não deixa a mensagem crua em inglês chegar ao líder', () => {
    expect(translateAuthError('Network request failed')).not.toMatch(/network/i);
  });

  it('mantém as traduções já existentes', () => {
    expect(translateAuthError('Invalid login credentials')).toBe(
      'E-mail ou senha inválidos.',
    );
    expect(translateAuthError('Email not confirmed')).toBe(
      'E-mail não confirmado. Verifique seu spam.',
    );
    expect(translateAuthError('User already registered')).toBe(
      'E-mail já cadastrado. Tente entrar ou recupere a senha.',
    );
    expect(translateAuthError('Request rate limit reached')).toMatch(
      /Muitas tentativas/,
    );
  });

  it('devolve a mensagem original quando não conhece o erro', () => {
    expect(translateAuthError('Something else broke')).toBe('Something else broke');
  });
});

describe('translateThrownAuthError', () => {
  it('trata Error de rede', () => {
    expect(translateThrownAuthError(new TypeError('Network request failed'))).toBe(
      MENSAGEM_ERRO_REDE,
    );
  });

  it('trata throw sem mensagem', () => {
    expect(translateThrownAuthError(undefined)).toBe(MENSAGEM_ERRO_REDE);
  });

  it('trata string solta', () => {
    expect(translateThrownAuthError('Invalid login credentials')).toBe(
      'E-mail ou senha inválidos.',
    );
  });
});
