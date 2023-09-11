import Application from '../application'

interface EventArgs {
    action: string,
    id: number,
    data: any,
}

export default class IpcBase {
    _application:Application

    constructor(application:Application){
        this._application = application
    }

    onEvent(channel, event, args:EventArgs){
        this._application.log('Ipc', 'Received event: ['+channel+']', args)
        if(typeof this[args.action] === 'function') {

            const response = (args.data.length > 0) ? this[args.action](args.data) : this[args.action]()
            response.then((result) => {
                this.send(channel, {
                    action: args.action,
                    id: args.id,
                    data: result,
                })
            }).catch((error) => {
                console.log('ERROR: IPC communication error from backend:', error)
            })

        } else {
            this._application.log('Ipc', 'Action was not found:', args.action)
        }
    }

    send(channel, args:EventArgs){
        this._application._mainWindow.webContents.send(channel, {
            action: args.action,
            id: args.id,
            data: args.data,
        })
    }
}