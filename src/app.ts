import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import routes from './routes';
import globalErrorHandler from './middlewares/global-error-handler';
import notFound from './middlewares/not-found';
import config from './config';

const app = express();

const corsOptions = {
  origin: config.corsOrigin.split(','),
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders:
    'Content-Type, Authorization, Origin, X-Requested-With, Accept, X-MessID',
  credentials: true,
};

app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(cors(corsOptions));

app.use('/api/v1', routes);

//global error handler
app.use(globalErrorHandler);

// handle not found routes
app.use(notFound);

export default app;
