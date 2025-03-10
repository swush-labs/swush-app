import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ArrowDownIcon } from 'lucide-react'

interface Token {
  name: string
  balance: string
}

interface TokenSelectorDialogProps {
  selectedToken: Token
  onSelectToken: (token: Token) => void
  availableTokens: Token[]
}

const TokenButton = ({ token, balance, onClick }: { token: string; balance: string; onClick: () => void }) => (
    <button
    onClick={onClick}
    className="flex items-center justify-between w-full p-4 text-left transition-colors rounded-lg hover:bg-accent"
  >
    <div className="flex items-center">
      <div className="w-8 h-8 mr-3 rounded-full bg-gradient-to-r from-blue-400 to-purple-500"></div>
      <div>
        <div className="font-semibold">{token}</div>
        <div className="text-sm text-muted-foreground">Balance: {balance}</div>
      </div>
    </div>
    <ArrowDownIcon className="w-4 h-4 text-muted-foreground" />
  </button>
)

export default function TokenSelectorDialog({ selectedToken, onSelectToken, availableTokens }: TokenSelectorDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTokens = availableTokens.filter(token =>
    token.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelectToken = (token: Token) => {
    onSelectToken(token)
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <TokenButton token={selectedToken.name} balance={selectedToken.balance} onClick={() => {}} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select a token</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search tokens"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-4"
        />
        <div className="grid gap-4 py-4 max-h-[300px] overflow-y-auto">
          {filteredTokens.map((token) => (
            <TokenButton
              key={token.name}
              token={token.name}
              balance={token.balance}
              onClick={() => handleSelectToken(token)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}