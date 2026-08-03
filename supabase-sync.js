  // ====== SUPABASE — armazenamento na nuvem ======
  // PREENCHA estes dois valores com os dados do seu projeto Supabase
  // (Settings → API, no painel do Supabase)
  const SUPABASE_URL = "https://uqqbtfjrwveofowbmcij.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_9LSO3W227sMOxITqE4vaEA_PZpLaG3U";

  const supabaseClient = (SUPABASE_URL.startsWith('http'))
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  const ID_FARMACIA = 'alvirosil';

  // Guarda os dados na nuvem de forma SEGURA: primeiro lê o que já está lá,
  // junta com os dados locais (sem apagar nada que outro telemóvel tenha guardado)
  // e só depois escreve. Isso evita que duas pessoas a usar ao mesmo tempo percam dados uma da outra.
  window.cloudSalvar = async function (dadosDbLocal) {
    if (!supabaseClient) { atualizarBadgeNuvem('⚠️ Supabase não configurado'); return; }
    try {
      const { data: linhaAtual } = await supabaseClient
        .from('farmacias')
        .select('dados')
        .eq('id', ID_FARMACIA)
        .maybeSingle();

      const dadosNuvemAtuais = linhaAtual ? linhaAtual.dados : null;
      const dadosFinais = dadosNuvemAtuais
        ? window.mesclarDb(dadosNuvemAtuais, dadosDbLocal) // o local mais recente ganha em conflitos
        : dadosDbLocal;
      if (window.recalcularStockDosProdutos) window.recalcularStockDosProdutos(dadosFinais); // nunca enviar um stock desatualizado

      const { error } = await supabaseClient
        .from('farmacias')
        .upsert({ id: ID_FARMACIA, dados: JSON.parse(JSON.stringify(dadosFinais)), atualizado_em: new Date().toISOString() });

      if (error) throw error;
      window._syncEstado = 'ok';
      window._ultimoSyncOk = Date.now();
      if (window.atualizarBadgeNuvem) window.atualizarBadgeNuvem('☁️ Sincronizado');
    } catch (erro) {
      const detalhe = erro && (erro.message || erro.error_description || erro.hint || JSON.stringify(erro));
      console.warn("☁️ Falha ao salvar na nuvem (modo offline?):", erro);
      window._syncEstado = 'falhou';
      if (window.atualizarBadgeNuvem) window.atualizarBadgeNuvem('❌ ' + (detalhe || 'Erro ao salvar') + ' (vai tentar de novo)');
    }
  };

  // Lê o objecto "db" guardado na nuvem (ou null se ainda não existir)
  window.cloudCarregar = async function () {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
      .from('farmacias')
      .select('dados')
      .eq('id', ID_FARMACIA)
      .maybeSingle();
    if (error) { console.warn("☁️ Erro ao carregar da nuvem:", error.message || error.hint || error.code || JSON.stringify(error)); return null; }
    return data ? data.dados : null;
  };

  // Fica "ligado" e avisa automaticamente sempre que outro telemóvel mudar algo na nuvem
  window.cloudEscutar = function (callback) {
    if (!supabaseClient) return null;
    return supabaseClient
      .channel('farmacias-mudancas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'farmacias', filter: `id=eq.${ID_FARMACIA}` }, (payload) => {
        if (payload.new && payload.new.dados) callback(payload.new.dados);
      })
      .subscribe();
  };

  // ============ CÓPIAS DE SEGURANÇA AUTOMÁTICAS ============
  // Guarda um "instantâneo" completo dos dados numa tabela à parte (farmacias_backups),
  // que nunca é sobrescrita — cada cópia fica com a sua própria data. Isto protege contra
  // apagões acidentais, dados corrompidos ou erros humanos: o dia de ontem fica sempre disponível.
  window.fazerBackupNuvem = async function (manual) {
    if (!supabaseClient) return { ok: false, erro: 'Supabase não configurado' };
    try {
      const { error } = await supabaseClient
        .from('farmacias_backups')
        .insert({ farmacia_id: ID_FARMACIA, dados: JSON.parse(JSON.stringify(db)), manual: !!manual });
      if (error) throw error;
      // Mantém só as últimas 30 cópias automáticas para não acumular indefinidamente
      // (cópias manuais nunca são apagadas automaticamente).
      const { data: antigas } = await supabaseClient
        .from('farmacias_backups')
        .select('id, criado_em')
        .eq('farmacia_id', ID_FARMACIA)
        .eq('manual', false)
        .order('criado_em', { ascending: false });
      if (antigas && antigas.length > 30) {
        const idsParaApagar = antigas.slice(30).map(b => b.id);
        await supabaseClient.from('farmacias_backups').delete().in('id', idsParaApagar);
      }
      db.config._ultimoBackupNuvem = new Date().toISOString();
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      return { ok: true };
    } catch (erro) {
      console.warn('☁️ Falha ao criar cópia de segurança:', erro);
      return { ok: false, erro: erro && (erro.message || JSON.stringify(erro)) };
    }
  };

  // Lista as cópias de segurança disponíveis (mais recente primeiro)
  window.listarBackupsNuvem = async function () {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from('farmacias_backups')
      .select('id, criado_em, manual')
      .eq('farmacia_id', ID_FARMACIA)
      .order('criado_em', { ascending: false })
      .limit(60);
    if (error) { console.warn('☁️ Erro ao listar cópias:', error.message); return []; }
    return data || [];
  };

  // Restaura uma cópia de segurança específica (substitui os dados atuais — usar com cuidado!)
  window.restaurarBackupNuvem = async function (backupId) {
    if (!supabaseClient) return { ok: false, erro: 'Supabase não configurado' };
    const { data, error } = await supabaseClient
      .from('farmacias_backups')
      .select('dados')
      .eq('id', backupId)
      .maybeSingle();
    if (error || !data) return { ok: false, erro: (error && error.message) || 'Cópia não encontrada' };
    db = data.dados;
    if (typeof recalcularStockDosProdutos === 'function') recalcularStockDosProdutos();
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    window.cloudSalvar(db);
    if (typeof renderAll === 'function') renderAll();
    return { ok: true };
  };

  // Verifica uma vez por dia se já passaram 24h desde a última cópia automática, e faz uma nova.
  setInterval(() => {
    const ultimo = db.config && db.config._ultimoBackupNuvem ? new Date(db.config._ultimoBackupNuvem).getTime() : 0;
    if (Date.now() - ultimo >= 24 * 60 * 60 * 1000) window.fazerBackupNuvem(false);
  }, 15 * 60 * 1000); // verifica a cada 15 min (mas só faz backup novo 1x por dia)

  // O app principal já carregou os dados locais; agora sincroniza com a nuvem
  // e, depois disso, fica escutando mudanças de outros telemóveis em tempo real.
  // A importação do XLSX só roda DEPOIS da sincronização, para garantir que,
  // se outro dispositivo já tiver importado, a flag (em db.config) já chegou
  // e este dispositivo não reimporta os produtos antigos por engano.
  if (window.sincronizarComNuvem) {
    window.sincronizarComNuvem().then(() => {
      if (window.importarProdutosXLSX) window.importarProdutosXLSX();
      if (window.escutarMudancasDaNuvem) window.escutarMudancasDaNuvem();
      // Primeira verificação de backup logo após a app abrir (não espera pelos 15 min)
      setTimeout(() => {
        const ultimo = db.config && db.config._ultimoBackupNuvem ? new Date(db.config._ultimoBackupNuvem).getTime() : 0;
        if (Date.now() - ultimo >= 24 * 60 * 60 * 1000) window.fazerBackupNuvem(false);
      }, 5000);
    });
  } else {
    if (window.importarProdutosXLSX) window.importarProdutosXLSX();
  }

  // Reforço automático: se uma sincronização falhar (rede fraca, telefone antigo, etc.),
  // volta a tentar sozinho a cada 45s, em vez de esperar a próxima venda/ação do funcionário.
  // Nada se perde localmente entretanto — os dados ficam sempre guardados no telefone.
  setInterval(() => {
    if (window._syncEstado === 'falhou' && window.sincronizarComNuvem) window.sincronizarComNuvem();
  }, 45000);

  // Aviso visível se ficar muito tempo sem conseguir sincronizar, para o funcionário saber
  // que não deve fechar/desinstalar a app enquanto isso não se resolver.
  setInterval(() => {
    if (window._syncEstado !== 'falhou') return;
    const minutos = window._ultimoSyncOk ? Math.round((Date.now() - window._ultimoSyncOk) / 60000) : null;
    if (minutos != null && minutos >= 5) {
      const el = document.getElementById('cloud-badge');
      if (el && el.textContent.indexOf('NÃO FECHES') === -1) {
        el.textContent = `❌ Sem sincronizar há ${minutos} min — NÃO FECHES a app`;
      }
    }
  }, 30000);
