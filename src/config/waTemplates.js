// src/config/waTemplates.js
export const WA_TEMPLATES = {
  // cámbialo por variable de entorno si Meta la vuelve a desactivar
  COBRANZA_REMINDER: process.env.WA_TEMPLATE_REMINDER || 'auto_pay_reminder_cobranza_4',
  COBRANZA_DOMICILIO: 'domiciliar_cobranza_v'
};
