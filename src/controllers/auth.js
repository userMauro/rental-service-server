const bcrypt = require('bcrypt')
const User = require('../models/User')
const { createToken, checkToken } = require('../config/jwt')

const authOK = (req, res, next) => {
    // middleware para chequear auth en endpoints
    try {
        const auth = req.get('authorization');     // recupera la cabecera http 'authorization' (es de express)

        let token = null;

        // extraigo el token de la cabecera
        if (auth && auth.toLowerCase().startsWith('bearer')) {
            token = auth.substring(7);
        };

        if (!checkToken(token)) {
            return res.status(401).json({status: false, msg: 'Necesitas un token de sesión para realizar esta acción'});
        };

        next()
    } catch (error) {
        next(error);
    };
}

const isAdmin =(req, res, next) => {
    try {
        const auth = req.get('authorization');

        let token = null;

        // extraigo el token de la cabecera
        if (auth && auth.toLowerCase().startsWith('bearer')) {
            token = auth.substring(7);
        };

        const data = checkToken(token)

        if (!data) {
            return res.status(401).json({status: false, msg: 'Necesitas un token de sesión para realizar esta acción'});
        };

        const { role } = data;

        if (role !== 'admin') {
            return res.status(403).json({ status: false, msg: 'Acceso denegado, no tiene los permisos necesarios.' });
        }

        next();
    } catch (error) {
        next(error)
    }
}

const register = async (req, res, next) => {
    try {
        const { password, username, name } = req.body

        // chequeo no repetir email
        const exists = await User.findOne({ where: { username } })
        if (exists) return res.status(400).json({ status: false, msg: 'El nombre de usuario ya está en uso' })

        // hashing password
        const saltRounds = 10
        const passwordHash = await bcrypt.hash(password, saltRounds)

        const newUser = await User.create({
            name,
            username,
            passwordHash,
            role: 'user',
        })

        return res.status(200).json({ status: true, msg: 'Usuario registrado con éxito' });
    } catch (error) {
        return next(error)
    };
}

const login = async (req, res, next) => {
    try {
        let { username, password } = req.body;

        // reviso si ya está logueado
        const logged = req.get('authorization');
        if (logged && logged.toLowerCase().startsWith('bearer')) {
            return res.status(400).json({status: false, msg: 'Ya hay una sesión abierta'})
        }

        const user = await User.findOne({ where: { username }})

        const passwordCorrect = (user === null) 
            ? false
            : await bcrypt.compare(password, user.passwordHash)
        
        if (!passwordCorrect) return res.status(400).json({status: false, msg: 'Usuario o contraseña incorrectos'})

        // si logueo bien, agrego la data que va a ir en el token codificado
        const data = {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
        };

        const { name, role, id } = user

        const token = createToken(data, '30d')
        return res.status(200).json({ status: true, msg: { id, username, name, role, token }})
    } catch (error) {
        return next(error);
    };
}

const resetUserPassword = async(req, res, next) => {
    try {
        const { username, password } = req.body

        // chequeo encontrar mail
        const user = await User.findOne({ where: { username }})
        if (!user) return res.status(400).json({status: false, msg: 'No existe el usuario'})

        // hash new passwd
        const saltRounds = 10
        const passwordHash = await bcrypt.hash(password, saltRounds)

        await user.update({ passwordHash });
        return res.status(200).json({ status: true, msg: 'Contraseña actualizada correctamente' });
    } catch (error) {
        return next(error);
    }
}

const getUsers = async (req, res, next) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'role', 'username', 'name'],
        });

        return res.status(200).json({ status: true, msg: users });
    } catch (error) {
        return next(error)
    };
}

module.exports = { register, resetUserPassword, login, getUsers, authOK, isAdmin };
