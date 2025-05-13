import WebSocket from 'ws';


class WSManager {
    private connections: Map<string, WebSocket> = new Map()

    connect(endpoint: string, name: string) {
        const ws = new WebSocket(endpoint)
        ws.on('open', () => {
            console.log(`Connected to ${name} WebSocket`)
        })
        this.connections.set(name, ws)
        return ws
    }

    sendCommand(method: string, params: any) {
        const message = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method,
            params,
        })
        
        this.connections.forEach((ws, name) => {
            console.log(`Sending command to ${name}`)
            ws.send(message)
        })
    }

    close() {
        this.connections.forEach(ws => ws.close())
    }
}