// secret
var SECRET = 'secret';

// config passport
var passport = require('passport');

var LocalStrategy = require('passport-local').Strategy;
passport.use('local', new LocalStrategy(
    function (username, password, done) {
        var user = {
            id: '1',
            username: 'admin',
            password: 'pass'
        }; // 可以配置通过数据库方式读取登陆账号

        if (username !== user.username) {
            return done(null, false, {message: 'Incorrect username.'});
        }
        if (password !== user.password) {
            return done(null, false, {message: 'Incorrect password.'});
        }

        return done(null, user);
    }
));

var PassPortJWT = require('passport-jwt');
var jsonwebtoken = require("jsonwebtoken");

function generateWebToken(username, options = {}) {
    return jsonwebtoken.sign({username: username}, SECRET, {
        expiresIn: "1h",
        issuer: "catcuts",
        audience: "meow"
    });
}

passport.use('jwt', new PassPortJWT.Strategy(
    {
        jwtFromRequest: PassPortJWT.ExtractJwt.fromAuthHeaderAsBearerToken(),  // 从HTTP认证头部获取令牌
        secretOrKey: SECRET,
        issuer: "catcuts",
        audience: "meow",
        session: false
    },
    function (payload, done) {
        return done(null, payload.username);
    }
));

passport.serializeUser(function (user, done) {//保存user对象
    done(null, user);//可以通过数据库方式操作
});

passport.deserializeUser(function (user, done) {//删除user对象
    done(null, user);//可以通过数据库方式操作
});

// use app middlewares
var express = require('express');
var bodyParser = bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var cookieSession = require('cookie-session');
var app = express();

app.use(bodyParser.json());  // for application/json
app.use(bodyParser.urlencoded({extended: true}));  // for application/x-www-form-urlencoded
app.use(bodyParser.text({type: 'text/html'}));  // for text/html
app.use(bodyParser.raw());  // for raw

app.use(cookieParser());
app.use(cookieSession({secret: 'meow', cookie: {maxAge: 60000}}));

app.use(passport.initialize());
app.use(passport.session());

// set app routes
// all routes but login need token authentication
app.all(
    '/',
    (req, res, next) => {
        passport.authenticate('jwt', (err, user, info) => {
            if (err) res.json({status: 'error', payload: {}, message: ''});
            else if (user) res.json({status: 'success', payload: {}, message: ''});
            else res.json({status: 'failed', payload: {}, message: 'authentication failed'});
        })(req, res, next);  // invoke the passport.authenticate
    });
// post login need local authentication for getting token
app.post(
    '/login',
    (req, res, next) => {
        passport.authenticate('local', (err, user, info) => {
            if (err) res.json({status: 'error', payload: {}, message: ''});
            else if (user) res.json({status: 'success', payload: { token: generateWebToken(user.username) }, message: ''});
            else res.json({status: 'failed', payload: {}, message: 'authentication failed'});
        })(req, res, next);  // invoke the passport.authenticate
    }
    // TODO if res.html then put token in cookie and set httponly
);
// get login return index.html
app.get(
    '/login',
    (req, res, next) => {
        if (req.query.ws !== undefined) res.sendFile(`${__dirname}/indexWS.html`);
        else res.sendFile(`${__dirname}/indexSIO.html`);
    }
);


var server = require('http').Server(app);
var io = require('socket.io')(server);
var socketioJwt = require('socketio-jwt');

// set socket.io routes
var data = { bedAmount: 10 };
io.of('/statistics')
    .on('connection', socketioJwt.authorize({
        secret: SECRET,
        timeout: 15000 // 15 seconds to send the authentication message
    }))
    .on('authenticated', function (socket) {
        var items = (socket.handshake.query.items || '').split(',');
        var updateBedAmount = setInterval(function () {
            let _data = {};
            for (let i = 0, len = items.length; i < len; i++) {
                let item = items[i];
                if (data[item] !== undefined) {
                    _data[item] = ++data[item];
                }
            }
            socket.volatile.emit('update', _data);
        }, 1000);

        socket.on('disconnect', function () {
            clearInterval(updateBedAmount);
        });
    });

server.listen(8090, () => {
    console.log('服务器已启动在：http://localhost:8090');
});