import Application from './application'
import express from 'express'
import expressWS from 'express-ws'
import expressProxy from 'express-http-proxy'
import path from 'path'
import Ipc from './ipc'
import { defaultSettings } from '../renderer/context/userContext.defaults'

export default class WebUI {
    _application:Application
    _express:express
    _ws:expressWS
    _ipc:Ipc
    _server

    constructor(application:Application){
        this._application = application
        this._application.log('webui', '已加载 WebUI 插件')

        const rawSettings = this._application._store.get('settings', defaultSettings) as object
        const settings = {...defaultSettings, ...rawSettings}

        // this._application.log('webui', 'Settings:', settings, rawSettings)

        if(settings.webui_autostart === true){
            this.startServer(settings.webui_port)
        } else {
            this._application._store.set('settings', {...settings, webui_enabled: false})
        }
    }

    startServer(port:number = 3000){
        this._application.log('webui', '正在启动 Web 服务器...')
        this._express = express()
        this._ws = expressWS(this._express)
        this._ipc = this._application._ipc

        // this._application._events.on('start', () => {
        //     this._ipc.onUserLoaded()
        // })

        this._express.get('/', (req, res) => {
            // res.send('Hello World!')
            // res.sendFile(path.join(__dirname, "../app/", "home.html"));
            res.redirect('/home')
        })

        this._express.ws('/ipc', (ws) => {

            // Websocket ipc hack
            for(const channel in this._ipc._channels){

                this._ipc._channels[channel].send = (channel, args) => {
                    console.log('HOOKED IPC:', channel, args)
                    ws.send(JSON.stringify({
                        channel: channel,
                        id: args.id,
                        action: args.action,
                        data: args.data,
                    }))
                    
                    this._application._mainWindow.webContents.send(channel, {
                        action: args.action,
                        id: args.id,
                        data: args.data,
                        error: args.error,
                    })
                }
            }

            ws.on('message', (msg) => {
                const ipcData = JSON.parse(msg)
                this._application.log('webui:websocket', '收到的事件:', ipcData)

                this._application._webUI._ipc._channels[ipcData.channel].onEvent(ipcData.channel, undefined, {
                    action: ipcData.action,
                    id: ipcData.id || 0,
                    data: ipcData.data,
                })

                // ws.send(msg);
            })
        })

        if(this._application._isProduction){
            this._express.use(express.static(path.join(__dirname, '../app/')))

            this._express.get('*', (req, res) => {
                // res.send('Hello World!')
                res.sendFile(path.join(__dirname, '../app/', 'home.html'))
            })
        } else {
            this._express.use(expressProxy('localhost', { port: 8888}))
        }


        this._server = this._express.listen(port, () => {
            this._application.log('webui', 'Web 服务器端口:', port)
            console.log(`Web 服务器端口: ${port}`)
        })
    }

    stopServer(){
        this._application.log('webui', '正在停止 Web 服务器...')
        if(this._express){
            this._server.close()
            delete this._express
        }
    }
}
