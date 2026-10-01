# DNH Barbearia v8

Versão redesenhada com inspiração nas categorias de recursos apresentadas publicamente pelo InBarber: agendamento online, gestão de agenda, clientes, serviços, estoque, equipe, financeiro, aniversariantes, personalização e compartilhamento do link. Não copia código ou identidade visual do serviço de terceiros.

## Configuração
1. Crie um projeto no Supabase.
2. Rode `supabase.sql` no SQL Editor.
3. Em Authentication > URL Configuration, configure a URL do site e a URL de redirecionamento.
4. Preencha `config.js` com Project URL e Publishable Key.
5. Crie uma conta.
6. No SQL Editor, promova a conta: `update public.profiles set role='admin' where email='seu@email.com';`
7. Hospede a pasta em Cloudflare Pages, GitHub Pages com servidor adequado, Netlify ou outro host estático.

## Observação
O link de agendamento e os recursos do painel dependem do Supabase. A confirmação/lembrete pelo WhatsApp abre uma conversa com mensagem pronta; o envio automático de mensagens exige uma integração de WhatsApp/API separada.
