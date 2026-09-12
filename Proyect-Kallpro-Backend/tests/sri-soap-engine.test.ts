import {
  buildRecepcionEnvelope, buildAutorizacionEnvelope, parseRecepcionResponse, parseAutorizacionResponse, SRI_CLAVE_YA_REGISTRADA,
} from '../src/services/finance/engines/sri-soap.engine';

const CLAVE = '1109202601179001234500110010010000000011551427414';

// Fixtures con la forma real de las respuestas del SRI (prefijos ns2/soap como los devuelve JAX-WS).
const RECIBIDA = `<?xml version='1.0' encoding='UTF-8'?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion"><RespuestaRecepcionComprobante><estado>RECIBIDA</estado><comprobantes/></RespuestaRecepcionComprobante></ns2:validarComprobanteResponse></soap:Body></soap:Envelope>`;

const DEVUELTA = `<?xml version='1.0' encoding='UTF-8'?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion"><RespuestaRecepcionComprobante><estado>DEVUELTA</estado><comprobantes><comprobante><claveAcceso>${CLAVE}</claveAcceso><mensajes><mensaje><identificador>39</identificador><mensaje>FIRMA INVALIDA</mensaje><informacionAdicional>Certificado no reconocido</informacionAdicional><tipo>ERROR</tipo></mensaje><mensaje><identificador>35</identificador><mensaje>ARCHIVO NO CUMPLE ESTRUCTURA XML</mensaje><tipo>ERROR</tipo></mensaje></mensajes></comprobante></comprobantes></RespuestaRecepcionComprobante></ns2:validarComprobanteResponse></soap:Body></soap:Envelope>`;

const YA_REGISTRADA = DEVUELTA.replace('<identificador>39</identificador>', `<identificador>${SRI_CLAVE_YA_REGISTRADA}</identificador>`);

const AUTORIZADO = `<?xml version='1.0' encoding='UTF-8'?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>${CLAVE}</claveAccesoConsultada><numeroComprobantes>1</numeroComprobantes><autorizaciones><autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>${CLAVE}</numeroAutorizacion><fechaAutorizacion>2026-09-11T10:15:30-05:00</fechaAutorizacion><ambiente>PRUEBAS</ambiente><comprobante><![CDATA[<?xml version="1.0" encoding="UTF-8"?><factura id="comprobante" version="1.1.0"><infoTributaria><claveAcceso>${CLAVE}</claveAcceso></infoTributaria></factura>]]></comprobante><mensajes/></autorizacion></autorizaciones></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse></soap:Body></soap:Envelope>`;

const NO_AUTORIZADO = `<?xml version='1.0' encoding='UTF-8'?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>${CLAVE}</claveAccesoConsultada><numeroComprobantes>1</numeroComprobantes><autorizaciones><autorizacion><estado>NO AUTORIZADO</estado><fechaAutorizacion>2026-09-11T10:15:30-05:00</fechaAutorizacion><ambiente>PRUEBAS</ambiente><comprobante>x</comprobante><mensajes><mensaje><identificador>65</identificador><mensaje>FECHA EMISION EXTEMPORANEA</mensaje><tipo>ERROR</tipo></mensaje></mensajes></autorizacion></autorizaciones></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse></soap:Body></soap:Envelope>`;

const SIN_RESPUESTA = `<?xml version='1.0' encoding='UTF-8'?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>${CLAVE}</claveAccesoConsultada><numeroComprobantes>0</numeroComprobantes><autorizaciones/></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse></soap:Body></soap:Envelope>`;

const FAULT = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault><faultcode>soap:Server</faultcode><faultstring>Servicio no disponible</faultstring></soap:Fault></soap:Body></soap:Envelope>`;

describe('sri-soap.engine — sobres', () => {
  it('el sobre de recepción lleva el XML en base64 dentro de validarComprobante/xml (sin prefijo)', () => {
    const env = buildRecepcionEnvelope('<factura/>');
    expect(env).toContain('xmlns:ec="http://ec.gob.sri.ws.recepcion"');
    expect(env).toContain('<ec:validarComprobante>');
    expect(env).toContain(`<xml>${Buffer.from('<factura/>').toString('base64')}</xml>`);
  });

  it('el sobre de autorización lleva la clave en claveAccesoComprobante', () => {
    const env = buildAutorizacionEnvelope(CLAVE);
    expect(env).toContain('xmlns:ec="http://ec.gob.sri.ws.autorizacion"');
    expect(env).toContain(`<claveAccesoComprobante>${CLAVE}</claveAccesoComprobante>`);
  });

  it('rechaza una clave de acceso que no tenga 49 dígitos', () => {
    expect(() => buildAutorizacionEnvelope('123')).toThrow(/49/);
  });
});

describe('sri-soap.engine — parseRecepcionResponse', () => {
  it('RECIBIDA sin mensajes', () => {
    expect(parseRecepcionResponse(RECIBIDA)).toEqual({ estado: 'RECIBIDA', mensajes: [] });
  });

  it('DEVUELTA con los mensajes de error del SRI, en orden', () => {
    const r = parseRecepcionResponse(DEVUELTA);
    expect(r.estado).toBe('DEVUELTA');
    expect(r.mensajes).toHaveLength(2);
    expect(r.mensajes[0]).toEqual({ identificador: '39', mensaje: 'FIRMA INVALIDA', informacionAdicional: 'Certificado no reconocido', tipo: 'ERROR' });
    expect(r.mensajes[1].identificador).toBe('35');
  });

  it('expone el código 43 (clave ya registrada) para que el servicio pase a consultar autorización', () => {
    const r = parseRecepcionResponse(YA_REGISTRADA);
    expect(r.estado).toBe('DEVUELTA');
    expect(r.mensajes.some((m) => m.identificador === SRI_CLAVE_YA_REGISTRADA)).toBe(true);
  });

  it('un SOAP Fault se convierte en error legible', () => {
    expect(() => parseRecepcionResponse(FAULT)).toThrow(/Servicio no disponible/);
  });
});

describe('sri-soap.engine — parseAutorizacionResponse', () => {
  it('AUTORIZADO: número, fecha y comprobante (CDATA) sin perder dígitos', () => {
    const r = parseAutorizacionResponse(AUTORIZADO);
    expect(r.estado).toBe('AUTORIZADO');
    expect(r.numeroAutorizacion).toBe(CLAVE); // 49 dígitos exactos → parseTagValue:false
    expect(r.fechaAutorizacion?.toISOString()).toBe('2026-09-11T15:15:30.000Z');
    expect(r.ambiente).toBe('PRUEBAS');
    expect(r.comprobante).toContain('<factura id="comprobante"');
    expect(r.mensajes).toEqual([]);
  });

  it('NO AUTORIZADO con motivo', () => {
    const r = parseAutorizacionResponse(NO_AUTORIZADO);
    expect(r.estado).toBe('NO AUTORIZADO');
    expect(r.mensajes[0].mensaje).toBe('FECHA EMISION EXTEMPORANEA');
  });

  it('sin autorizaciones (numeroComprobantes 0) → SIN_RESPUESTA para reintentar luego', () => {
    expect(parseAutorizacionResponse(SIN_RESPUESTA).estado).toBe('SIN_RESPUESTA');
  });
});
