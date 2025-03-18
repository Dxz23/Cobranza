// src/services/whatsappService.js
import axios from 'axios';
import config from '../config/env.js';

class WhatsAppService {
  /**
   * Envía un mensaje de plantilla a un número de WhatsApp.
   * @param {string} to - Número destinatario en formato +521XXXXXXXXXX (Ej: "+5216641234567")
   * @param {string} templateName - Nombre de la plantilla en WhatsApp Cloud
   * @param {string} languageCode - Idioma (ej: 'es_MX')
   * @param {Array} components - Parámetros para personalizar la plantilla
   */
  async sendTemplateMessage(to, templateName, languageCode = 'es_MX', components = []) {
    const data = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components.length ? components : undefined
      }
    };

    const url = `${config.BASE_URL}/${config.API_VERSION}/${config.BUSINESS_PHONE}/messages`;
    const headers = {
      Authorization: `Bearer ${config.API_TOKEN}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios.post(url, data, { headers, timeout: 15000 });
      return response.data;
    } catch (error) {
      console.error('Error al enviar plantilla:', error?.response?.data || error);
      throw error;
    }
  }

  /**
   * Envía una imagen a un número de WhatsApp.
   * @param {string} to - Número destinatario en formato +521XXXXXXXXXX
   * @param {string} imageUrl - URL pública de la imagen
   * @param {string} caption - Texto opcional que acompañará la imagen
   */
  async sendImageMessage(to, imageUrl, caption = '') {
    const data = {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: {
        link: imageUrl,
        caption
      }
    };

    const url = `${config.BASE_URL}/${config.API_VERSION}/${config.BUSINESS_PHONE}/messages`;
    const headers = {
      Authorization: `Bearer ${config.API_TOKEN}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios.post(url, data, { headers, timeout: 15000 });
      return response.data;
    } catch (error) {
      console.error('Error al enviar imagen:', error?.response?.data || error);
      throw error;
    }
  }

  /**
   * Envía un documento (PDF, etc.) a un número de WhatsApp.
   * @param {string} to - Número destinatario en formato +521XXXXXXXXXX
   * @param {string} docUrl - URL pública del documento
   * @param {string} filename - Nombre que se mostrará en el documento
   */
  async sendDocumentMessage(to, docUrl, filename = 'Documento') {
    const data = {
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: {
        link: docUrl,
        filename
      }
    };

    const url = `${config.BASE_URL}/${config.API_VERSION}/${config.BUSINESS_PHONE}/messages`;
    const headers = {
      Authorization: `Bearer ${config.API_TOKEN}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios.post(url, data, { headers, timeout: 15000 });
      return response.data;
    } catch (error) {
      console.error('Error al enviar documento:', error?.response?.data || error);
      throw error;
    }
  }
}

export default new WhatsAppService();
