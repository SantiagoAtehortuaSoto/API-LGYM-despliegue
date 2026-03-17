const { sendContactEmail } = require('../services/email.service');

const handleContactForm = async (req, res) => {
    const { nombre, email, telefono, mensaje } = req.contactPayload || req.body;
    const companyEmail = req.companyEmail;

    try {
        const emailSent = await sendContactEmail(nombre, email, telefono, mensaje, companyEmail);
        if (!emailSent) {
            console.error('[Contactanos][handleContactForm] No se pudo enviar el correo de contacto');
            return res.status(502).json({ message: 'No se pudo enviar el mensaje de contacto' });
        }
        return res.status(200).json({ message: 'Mensaje enviado correctamente' });
    } catch (error) {
        console.error('[Contactanos][handleContactForm] Error inesperado:', error);
        return res.status(500).json({ message: 'Error al procesar el mensaje de contacto' });
    }
};

module.exports = { handleContactForm };
